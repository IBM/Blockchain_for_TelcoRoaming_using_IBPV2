'use strict';
/*
* Copyright IBM Corp All Rights Reserved
*
* SPDX-License-Identifier: Apache-2.0
*/
/*
 * Invoke the telco-roaming-contract to make a call.
 * node callOut.js <simPublicKey>
 * eg. node callOut.js sim1
 *
 * Assumptions: Ideally, a call would require the sim_id/msisdn to which the call is being made, but for simplicity we are ignoring that for now. Ideally, multiple calls can be made at the same time (using call holding), but for simplicity we are assuming that only 1 call can be made at a time.
 *
 * 1. call verifyUser - to authenticate the sim and check if the sim is reaching overage limits.
 * 2. call setOverageFlag - to update the allowOverage flag.
 * 3. call callOut - to make the call.
 *
 * At step 1, an error is thrown if the sim has isValid = Fraud, thereby preventing the sim from making a call.
 * Otherwise, the user is checked to see if they have reached overage limits.
 * If the user has just reached the overage limit, then they are prompted to accept or deny the overage charges.
 * Their response is stored as the allowOverage flag in the sim as part of step 2 and will decide if this as well as all future calls are made or not based on whether they accepted or denied the overage charges.
 * Step 3 makes use of the overageFlags to make the call and save the start time of the call.
 */

let util = require('util');
let prompts = require('prompts');

const fs = require('fs');
const path = require('path');

// Bring Fabric SDK network class
const { FileSystemWallet, Gateway } = require('fabric-network');

// A wallet stores a collection of identities for use
let walletDir = path.join(path.dirname(require.main.filename),'fabric/_idwallet');
const wallet = new FileSystemWallet(walletDir);
const configDirectory = path.join(process.cwd(), 'fabric');
const configPath = path.join(configDirectory, 'config.json');
const configJSON = fs.readFileSync(configPath, 'utf8');
const config = JSON.parse(configJSON);
let channelName = config.channel_name;
let smartContractName = config.smart_contract_name;
let connection_file = config.connection_file;
let appAdmin = config.appAdmin;
let peerAddr = config.peerName;

let gatewayDiscoveryEnabled = 'enabled' in config.gatewayDiscovery?config.gatewayDiscovery.enabled:true;
let gatewayDiscoveryAsLocalhost = 'asLocalhost' in config.gatewayDiscovery?config.gatewayDiscovery.asLocalhost:true;

const ccpPath = path.join(configDirectory, connection_file);
const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
const ccp = JSON.parse(ccpJSON);

const gateway = new Gateway();

let promises = [];

process.on('unhandledRejection', error => {
    // Will print "unhandledRejection err is not defined"
    console.log('An unhandled rejection was found - ', error.message);
    return process.exit(1);
});

async function main() {
    if(process.argv.length !== 3){
        throw new Error('Process argv length is ' + process.argv.length + '. It should be 3');
    }

    let simPublicKey = process.argv[2];

    // A gateway defines the peers used to access Fabric networks

    await gateway.connect(ccp, { wallet, identity: appAdmin , discovery: {enabled: gatewayDiscoveryEnabled, asLocalhost:gatewayDiscoveryAsLocalhost }});
    // eslint-disable-next-line no-unused-vars
    const network = await gateway.getNetwork(channelName);
    const client = gateway.getClient();
    const channel = client.getChannel(channelName);

    let event_hub = channel.newChannelEventHub(peerAddr);

    // get a transaction id object based on the current user assigned to fabric client
    let tx_id = client.newTransactionID(true);
    let fcn = 'verifyUser';
    console.log(`Sending transaction proposal for ${fcn} with transaction id ${tx_id._transaction_id}`);
    // must send the proposal to endorsing peers
    let request = {
        //targets: let default to the peer assigned to the client
        chaincodeId: smartContractName,
        fcn: fcn,
        args: [simPublicKey],
        chainId: channelName,
        txId: tx_id
    };
    // send the transaction proposal to the peers
    channel.sendTransactionProposal(request).then((results) => {
        let proposalResponses = results[0];
        let proposal = results[1];
        let isProposalGood = false;
        if (proposalResponses && proposalResponses[0].response && proposalResponses[0].response.status === 200) {
            isProposalGood = true;
            console.log('Transaction proposal was good');
        } else {
            console.error('Transaction proposal was bad');
        }
        if (isProposalGood) {
            console.log(util.format(
                'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s"',
                proposalResponses[0].response.status, proposalResponses[0].response.message));

            // build up the request for the orderer to have the transaction committed
            let request = {
                proposalResponses: proposalResponses,
                proposal: proposal
            };

            let sendPromise = channel.sendTransaction(request);
            promises.push(sendPromise); //we want the send transaction first, so that we know where to check status

            console.log(`Created Promise - ${fcn} for ` + simPublicKey);
        }

        //console.log("Created eventhub - ", event_hub);
        event_hub.connect(true);
        //console.log("connected to eventhub");
        let regid = event_hub.registerChaincodeEvent('telco-roaming-contract', 'VerifyUserEvent-'+simPublicKey, function(event) {
            console.log('Found VerifyUserEvent');
            //console.log(event);
            //console.log(util.format("Custom event received, payload: %j\n", event.payload.toString()));
            event_hub.unregisterChaincodeEvent(regid);

            let overageFlag = JSON.parse(event.payload.toString()).nearingOverage;
            let allowOverage = JSON.parse(event.payload.toString()).allowOverage;
            if(overageFlag === 'false' || (overageFlag === 'true' && allowOverage !== '')){
                //either hasn't reached overage, or has reached overage and we have already asked if the user agrees witht he overage charges or not.
                // get a transaction id object based on the current user assigned to fabric client
                let tx_id = client.newTransactionID(true);
                fcn = 'setOverageFlag';
                console.log(`Sending transaction proposal for ${fcn} with transaction id ${tx_id._transaction_id}`);
                // must send the proposal to endorsing peers
                let request = {
                    //targets: let default to the peer assigned to the client
                    chaincodeId: smartContractName,
                    fcn: fcn,
                    args: [simPublicKey, allowOverage],
                    chainId: channelName,
                    txId: tx_id
                };
                // send the transaction proposal to the peers
                channel.sendTransactionProposal(request).then((results) => {
                    let proposalResponses = results[0];
                    let proposal = results[1];
                    let isProposalGood = false;
                    if (proposalResponses && proposalResponses[0].response && proposalResponses[0].response.status === 200) {
                        isProposalGood = true;
                        console.log('Transaction proposal was good');
                    } else {
                        console.error('Transaction proposal was bad');
                    }
                    if (isProposalGood) {
                        console.log(util.format(
                            'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s"',
                            proposalResponses[0].response.status, proposalResponses[0].response.message));

                        // build up the request for the orderer to have the transaction committed
                        let request = {
                            proposalResponses: proposalResponses,
                            proposal: proposal
                        };

                        let sendPromise = channel.sendTransaction(request);
                        promises.push(sendPromise); //we want the send transaction first, so that we know where to check status

                        console.log(`Created Promise - ${fcn} for ` + simPublicKey);
                    }

                    //console.log("Created eventhub - ", event_hub);
                    event_hub.connect(true);
                    //console.log("connected to eventhub");
                    let regid = event_hub.registerChaincodeEvent('telco-roaming-contract', 'SetOverageFlagEvent-'+simPublicKey, function() {
                        console.log('Found SetOverageFlagEvent');
                        //console.log(event);
                        //console.log(util.format("Custom event received, payload: %j\n", event.payload.toString()));
                        event_hub.unregisterChaincodeEvent(regid);
                        let tx_id = client.newTransactionID(true);
                        let fcn = 'callOut';
                        console.log(`Sending transaction proposal for ${fcn} with transaction id ${tx_id._transaction_id}`);
                        // must send the proposal to endorsing peers
                        let request = {
                            //targets: let default to the peer assigned to the client
                            chaincodeId: smartContractName,
                            fcn: fcn,
                            args: [simPublicKey],
                            chainId: channelName,
                            txId: tx_id
                        };
                        // send the transaction proposal to the peers
                        channel.sendTransactionProposal(request).then((results) => {
                            let proposalResponses = results[0];
                            let proposal = results[1];
                            let isProposalGood = false;
                            if (proposalResponses && proposalResponses[0].response && proposalResponses[0].response.status === 200) {
                                isProposalGood = true;
                                console.log('Transaction proposal was good');
                            } else {
                                console.error('Transaction proposal was bad');
                            }
                            if (isProposalGood) {
                                console.log(util.format(
                                    'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s"',
                                    proposalResponses[0].response.status, proposalResponses[0].response.message));

                                // build up the request for the orderer to have the transaction committed
                                let request = {
                                    proposalResponses: proposalResponses,
                                    proposal: proposal
                                };

                                let sendPromise = channel.sendTransaction(request);
                                promises.push(sendPromise); //we want the send transaction first, so that we know where to check status

                                console.log(`Created Promise - ${fcn} for ` + simPublicKey);
                            }

                            //console.log("Created eventhub - ", event_hub);
                            event_hub.connect(true);
                            //console.log("connected to eventhub");
                            let regid = event_hub.registerChaincodeEvent('telco-roaming-contract', 'CallOutEvent-'+simPublicKey, function() {
                                console.log('Found CallOutEvent');
                                //console.log(event);
                                //console.log(util.format("Custom event received, payload: %j\n", event.payload.toString()));
                                event_hub.unregisterChaincodeEvent(regid);
                                return process.exit(0);
                            });
                        });
                    });
                });
            }
            else{ //i.e if (overageFlag === 'true' && allowOverage === '')
                //has reached overage and we have not asked if the user agrees with the overage charges or not.
                (async () => {
                    const response = await prompts({
                        type: 'select',
                        name: 'value',
                        message: 'The user is nearing overage limits. This call and all futher calls may incur additional charges. Do you accept?',
                        choices: [
                            { title: 'Yes', value: 'Yes' },
                            { title: 'No', value: 'No'}
                        ],
                        initial: 1
                    });
                    if(response.value === 'Yes'){
                        //call a function that sets the allowOverage to true
                        //and continue with callOut function
                        allowOverage = 'true';
                    }
                    else{
                        //call function that sets the allowOverage to false
                        //throw error as cannot go for callOut now
                        allowOverage = 'false';
                    }
                    // get a transaction id object based on the current user assigned to fabric client
                    let tx_id = client.newTransactionID(true);
                    fcn = 'setOverageFlag';
                    console.log(`Sending transaction proposal for ${fcn} with transaction id ${tx_id._transaction_id}`);
                    // must send the proposal to endorsing peers
                    let request = {
                        //targets: let default to the peer assigned to the client
                        chaincodeId: smartContractName,
                        fcn: fcn,
                        args: [simPublicKey, allowOverage],
                        chainId: channelName,
                        txId: tx_id
                    };
                    // send the transaction proposal to the peers
                    channel.sendTransactionProposal(request).then((results) => {
                        let proposalResponses = results[0];
                        let proposal = results[1];
                        let isProposalGood = false;
                        if (proposalResponses && proposalResponses[0].response && proposalResponses[0].response.status === 200) {
                            isProposalGood = true;
                            console.log('Transaction proposal was good');
                        } else {
                            console.error('Transaction proposal was bad');
                        }
                        if (isProposalGood) {
                            console.log(util.format(
                                'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s"',
                                proposalResponses[0].response.status, proposalResponses[0].response.message));

                            // build up the request for the orderer to have the transaction committed
                            let request = {
                                proposalResponses: proposalResponses,
                                proposal: proposal
                            };

                            let sendPromise = channel.sendTransaction(request);
                            promises.push(sendPromise); //we want the send transaction first, so that we know where to check status

                            console.log(`Created Promise - ${fcn} for ` + simPublicKey);
                        }

                        //console.log("Created eventhub - ", event_hub);
                        event_hub.connect(true);
                        //console.log("connected to eventhub");
                        let regid = event_hub.registerChaincodeEvent('telco-roaming-contract', 'SetOverageFlagEvent-'+simPublicKey, function() {
                            console.log('Found SetOverageFlagEvent');
                            //console.log(event);
                            //console.log(util.format("Custom event received, payload: %j\n", event.payload.toString()));
                            event_hub.unregisterChaincodeEvent(regid);
                            let tx_id = client.newTransactionID(true);
                            fcn = 'callOut';
                            console.log(`Sending transaction proposal for ${fcn} with transaction id ${tx_id._transaction_id}`);
                            // must send the proposal to endorsing peers
                            let request = {
                                //targets: let default to the peer assigned to the client
                                chaincodeId: smartContractName,
                                fcn: fcn,
                                args: [simPublicKey],
                                chainId: channelName,
                                txId: tx_id
                            };
                            // send the transaction proposal to the peers
                            channel.sendTransactionProposal(request).then((results) => {
                                let proposalResponses = results[0];
                                let proposal = results[1];
                                let isProposalGood = false;
                                if (proposalResponses && proposalResponses[0].response && proposalResponses[0].response.status === 200) {
                                    isProposalGood = true;
                                    console.log('Transaction proposal was good');
                                } else {
                                    console.error('Transaction proposal was bad');
                                }
                                if (isProposalGood) {
                                    console.log(util.format(
                                        'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s"',
                                        proposalResponses[0].response.status, proposalResponses[0].response.message));

                                    // build up the request for the orderer to have the transaction committed
                                    let request = {
                                        proposalResponses: proposalResponses,
                                        proposal: proposal
                                    };

                                    let sendPromise = channel.sendTransaction(request);
                                    promises.push(sendPromise); //we want the send transaction first, so that we know where to check status

                                    console.log(`Created Promise - ${fcn} for ` + simPublicKey);
                                }

                                //console.log("Created eventhub - ", event_hub);
                                event_hub.connect(true);
                                //console.log("connected to eventhub");
                                let regid = event_hub.registerChaincodeEvent('telco-roaming-contract', 'CallOutEvent-'+simPublicKey, function() {
                                    console.log('Found CallOutEvent');
                                    //console.log(event);
                                    //console.log(util.format("Custom event received, payload: %j\n", event.payload.toString()));
                                    event_hub.unregisterChaincodeEvent(regid);
                                    return process.exit(0);
                                });
                            });
                        });
                    });
                })();
            }
        });
    });
}

main();
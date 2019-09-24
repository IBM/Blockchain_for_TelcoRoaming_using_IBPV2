'use strict';
/*
* Copyright IBM Corp All Rights Reserved
*
* SPDX-License-Identifier: Apache-2.0
*/
/*
 * Invoke the telco-roaming-contract to move a SubscriberSim to a new location.
 * node moveSim.js <simPublicKey> <location>
 * eg. node moveSim.js sim1 European\ Union
 *
 *
 * 1. call moveSim to move the sim to a new location.
 * 2. call authentication to verify that the sim is Active (and not a Fraud). Only then will the following calls be performed.
 * 3. call discovery to update the roamingPartner details.
 * 4. call updateRate to update the roaming and overage rates for the sim.
 *
 * Will throw an error and processing will stop at step 2 if the sim has isValid = Fraud.
 * Otherwise, should successfully complete without errors and the ledger should show that the sim has moved to a new location.
 * If the new location is different from home location, then the sim should have the correct RoamingPartner specified.
 * If the new location is the home location, the RoamingPartner for the sim will be blank.
 * The roaming and overage rates will be updated to reflect those specified by the roaming partner.
 */

let util = require('util');

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
    if(process.argv.length !== 4){
        throw new Error('Process argv length is ' + process.argv.length + '. It should be 4');
    }

    let simPublicKey = process.argv[2];
    let newLocation = process.argv[3];

    // A gateway defines the peers used to access Fabric networks

    await gateway.connect(ccp, { wallet, identity: appAdmin , discovery: {enabled: gatewayDiscoveryEnabled, asLocalhost:gatewayDiscoveryAsLocalhost }});
    // eslint-disable-next-line no-unused-vars
    const network = await gateway.getNetwork(channelName);
    const client = gateway.getClient();
    const channel = client.getChannel(channelName);

    let event_hub = channel.newChannelEventHub(peerAddr);

    // get a transaction id object based on the current user assigned to fabric client
    let tx_id = client.newTransactionID(true);
    let fcn = 'moveSim';
    console.log(`Sending transaction proposal for ${fcn} with transaction id ${tx_id._transaction_id}`);

    // must send the proposal to endorsing peers
    let request = {
        //targets: let default to the peer assigned to the client
        chaincodeId: smartContractName,
        fcn: fcn,
        args: [simPublicKey, newLocation],
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
        let regid = event_hub.registerChaincodeEvent('telco-roaming-contract', 'MoveEvent-'+simPublicKey, function() {
            console.log('Found MoveEvent');
            //console.log(event);
            //console.log(util.format("Custom event received, payload: %j\n", event.payload.toString()));
            event_hub.unregisterChaincodeEvent(regid);
            // get a transaction id object based on the current user assigned to fabric client
            tx_id = client.newTransactionID(true);
            fcn = 'discovery';
            console.log(`Sending transaction proposal for ${fcn} with transaction id ${tx_id._transaction_id}`);
            // must send the proposal to endorsing peers
            request = {
                //targets: let default to the peer assigned to the client
                chaincodeId: smartContractName,
                fcn: fcn,
                args: [simPublicKey],
                chainId: channelName,
                txId: tx_id
            };
            // send the transaction proposal to the peers
            channel.sendTransactionProposal(request).then((results) =>{
                proposalResponses = results[0];
                proposal = results[1];
                isProposalGood = false;
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

                event_hub.connect(true);
                //console.log("connected to eventhub");
                let regid = event_hub.registerChaincodeEvent('telco-roaming-contract', 'DiscoveryEvent-'+simPublicKey, function(event) {
                    console.log('Found discovery event');
                    //console.log(event);
                    //console.log(util.format("Custom event received, payload: %j\n", event.payload.toString()));
                    let eventPayload = JSON.parse(event.payload.toString());
                    let operatorName = eventPayload.localOperator;
                    event_hub.unregisterChaincodeEvent(regid);
                    // get a transaction id object based on the current user assigned to fabric client
                    tx_id = client.newTransactionID(true);
                    fcn = 'authentication';
                    console.log(`Sending transaction proposal for ${fcn} with transaction id ${tx_id._transaction_id}`);
                    // must send the proposal to endorsing peers
                    request = {
                        //targets: let default to the peer assigned to the client
                        chaincodeId: smartContractName,
                        fcn: fcn,
                        args: [simPublicKey],
                        chainId: channelName,
                        txId: tx_id
                    };
                    // send the transaction proposal to the peers
                    channel.sendTransactionProposal(request).then((results) =>{
                        proposalResponses = results[0];
                        proposal = results[1];
                        isProposalGood = false;
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

                        event_hub.connect(true);
                        //console.log("connected to eventhub");
                        let regid = event_hub.registerChaincodeEvent('telco-roaming-contract', 'AuthenticationEvent-'+simPublicKey, function() {
                            console.log('Found authentication event');
                            //console.log(event);
                            //console.log(util.format("Custom event received, payload: %j\n", event.payload.toString()));
                            event_hub.unregisterChaincodeEvent(regid);
                            // get a transaction id object based on the current user assigned to fabric client
                            tx_id = client.newTransactionID(true);
                            fcn = 'updateRate';
                            console.log(`Sending transaction proposal for ${fcn} with transaction id ${tx_id._transaction_id}`);
                            // must send the proposal to endorsing peers
                            request = {
                                //targets: let default to the peer assigned to the client
                                chaincodeId: smartContractName,
                                fcn: fcn,
                                args: [simPublicKey, operatorName],
                                chainId: channelName,
                                txId: tx_id
                            };
                            // send the transaction proposal to the peers
                            channel.sendTransactionProposal(request).then((results) =>{
                                proposalResponses = results[0];
                                proposal = results[1];
                                isProposalGood = false;
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

                                event_hub.connect(true);
                                //console.log("connected to eventhub");
                                let regid = event_hub.registerChaincodeEvent('telco-roaming-contract', 'UpdateRateEvent-'+simPublicKey, function() {
                                    console.log('Found updateRate event');
                                    //console.log(event);
                                    //console.log(util.format("Custom event received, payload: %j\n", event.payload.toString()));
                                    event_hub.unregisterChaincodeEvent(regid);
                                    return process.exit(0);
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}

main();
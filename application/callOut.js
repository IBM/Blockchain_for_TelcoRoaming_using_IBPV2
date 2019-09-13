'use strict';
/*
* Copyright IBM Corp All Rights Reserved
*
* SPDX-License-Identifier: Apache-2.0
*/
/*
 * Chaincode Invoke
 */

var util = require('util');
var Fabric_Client = require('fabric-client');
var fabric_client = new Fabric_Client();
var prompts = require('prompts');

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
let userName = config.appAdmin;
var connection_file = config.connection_file;
var appAdmin = config.appAdmin;
//var appAdminSecret = config.appAdminSecret;
var peerAddr = config.peerName;
var orgMSPID = config.orgMSPID;

let gatewayDiscoveryEnabled = 'enabled' in config.gatewayDiscovery?config.gatewayDiscovery.enabled:true;
let gatewayDiscoveryAsLocalhost = 'asLocalHost' in config.gatewayDiscovery?config.gatewayDiscovery.asLocalhost:true;

const ccpPath = path.join(configDirectory, connection_file);
const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
const ccp = JSON.parse(ccpJSON);

const gateway = new Gateway();

var promises = [];

process.on('unhandledRejection', error => {
    // Will print "unhandledRejection err is not defined"
    console.log('unhandledRejection', error.message);
    return process.exit(1);
});

async function main() {
    if(process.argv.length != 3){
        console.log("Process argv length is ", process.argv.length, ". It should be 3");
        process.exit(1);
    }
    
    let simPublicKey = process.argv[2];

    // A gateway defines the peers used to access Fabric networks
    
    await gateway.connect(ccp, { wallet, identity: appAdmin , discovery: {enabled: gatewayDiscoveryEnabled, asLocalhost:gatewayDiscoveryAsLocalhost }});
    console.log('Connected to Fabric gateway.');

    // Get addressability to network
    const network = await gateway.getNetwork(channelName);

    const client = gateway.getClient();
    
    const channel = client.getChannel(channelName);
    console.log('Got addressability to channel.');

	var user = await client.getUserContext(appAdmin, true);

    // Get addressability to  contract
    const contract = await network.getContract(smartContractName);
    console.log('Got addressability to contract');

    let event_hub = channel.newChannelEventHub(peerAddr);
    
    // get a transaction id object based on the current user assigned to fabric client
    var tx_id = client.newTransactionID(true);
    console.log("Assigning transaction_id: ", tx_id._transaction_id); 
    // must send the proposal to endorsing peers
    var request = {
        //targets: let default to the peer assigned to the client
        chaincodeId: smartContractName,
        fcn: 'verifyUser',
        args: [simPublicKey],
        chainId: channelName,
        txId: tx_id
    };
    // send the transaction proposal to the peers
    channel.sendTransactionProposal(request).then((results) => {
        var proposalResponses = results[0];
        var proposal = results[1];
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
            var request = {
                proposalResponses: proposalResponses,
                proposal: proposal
            };

            var sendPromise = channel.sendTransaction(request);
            promises.push(sendPromise); //we want the send transaction first, so that we know where to check status

            console.log("Created Promise - verifyUser");
        }
        
        //console.log("Created eventhub - ", event_hub);
        event_hub.connect(true);
        console.log("connected to eventhub");
        var regid = event_hub.registerChaincodeEvent('telco-roaming-contract', 'VerifyUserEvent-'+simPublicKey, function(event) {
            console.log(`Found VerifyUserEvent`);
            console.log(event);
            console.log(util.format("Custom event received, payload: %j\n", event.payload.toString()));
            event_hub.unregisterChaincodeEvent(regid);
            
            let overageFlag = JSON.parse(event.payload.toString()).nearingOverage;
            let allowOverage = JSON.parse(event.payload.toString()).allowOverage;
            console.log(overageFlag);
            console.log(allowOverage);
            if(overageFlag === 'FALSE' || (overageFlag === 'TRUE' && allowOverage !== '')){
                //either hasn't reached overage, or has reached overage and we have already asked if the user agrees witht he overage charges or not.
                // get a transaction id object based on the current user assigned to fabric client
                var tx_id = client.newTransactionID(true);
                console.log("Assigning transaction_id: ", tx_id._transaction_id); 
                // must send the proposal to endorsing peers
                var request = {
                    //targets: let default to the peer assigned to the client
                    chaincodeId: smartContractName,
                    fcn: 'setOverageFlag',
                    args: [simPublicKey, overageFlag, allowOverage],
                    chainId: channelName,
                    txId: tx_id
                };
                // send the transaction proposal to the peers
                channel.sendTransactionProposal(request).then((results) => {
                    var proposalResponses = results[0];
                    var proposal = results[1];
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
                        var request = {
                            proposalResponses: proposalResponses,
                            proposal: proposal
                        };

                        var sendPromise = channel.sendTransaction(request);
                        promises.push(sendPromise); //we want the send transaction first, so that we know where to check status

                        console.log("Created Promise - setOverageFlag");
                    }

                    //console.log("Created eventhub - ", event_hub);
                    event_hub.connect(true);
                    console.log("connected to eventhub");
                    var regid = event_hub.registerChaincodeEvent('telco-roaming-contract', 'SetOverageFlagEvent-'+simPublicKey, function(event) {
                        console.log(`Found SetOverageFlagEvent`);
                        console.log(event);
                        console.log(util.format("Custom event received, payload: %j\n", event.payload.toString()));
                        event_hub.unregisterChaincodeEvent(regid);
                        var tx_id = client.newTransactionID(true);
                        console.log("Assigning transaction_id: ", tx_id._transaction_id); 
                        // must send the proposal to endorsing peers
                        var request = {
                            //targets: let default to the peer assigned to the client
                            chaincodeId: smartContractName,
                            fcn: 'callOut',
                            args: [simPublicKey],
                            chainId: channelName,
                            txId: tx_id
                        };
                        // send the transaction proposal to the peers
                        channel.sendTransactionProposal(request).then((results) => {
                            var proposalResponses = results[0];
                            var proposal = results[1];
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
                                var request = {
                                    proposalResponses: proposalResponses,
                                    proposal: proposal
                                };

                                var sendPromise = channel.sendTransaction(request);
                                promises.push(sendPromise); //we want the send transaction first, so that we know where to check status

                                console.log("Created Promise - callOut");
                            }

                            //console.log("Created eventhub - ", event_hub);
                            event_hub.connect(true);
                            console.log("connected to eventhub");
                            var regid = event_hub.registerChaincodeEvent('telco-roaming-contract', 'CallOutEvent-'+simPublicKey, function(event) {
                                console.log(`Found CallOutEvent`);
                                console.log(event);
                                console.log(util.format("Custom event received, payload: %j\n", event.payload.toString()));
                                event_hub.unregisterChaincodeEvent(regid);
                                return process.exit(0);
                            });
                        });
                    });
                });
            }
            else{ //i.e if (overageFlag === 'TRUE' && allowOverage === '')
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
                    console.log(response.value);
                    if(response.value === 'Yes'){
                        //call a function that sets the allowOverage to true
                        //and continue with callOut function
                        allowOverage = 'TRUE';
                    }
                    else{
                        //call function that sets the allowOverage to false
                        //throw error as cannot go for callOut now
                        allowOverage = 'FALSE';
                    }
                    // get a transaction id object based on the current user assigned to fabric client
                    var tx_id = client.newTransactionID(true);
                    console.log("Assigning transaction_id: ", tx_id._transaction_id); 
                    // must send the proposal to endorsing peers
                    var request = {
                        //targets: let default to the peer assigned to the client
                        chaincodeId: smartContractName,
                        fcn: 'setOverageFlag',
                        args: [simPublicKey, overageFlag, allowOverage],
                        chainId: channelName,
                        txId: tx_id
                    };
                    // send the transaction proposal to the peers
                    channel.sendTransactionProposal(request).then((results) => {
                        var proposalResponses = results[0];
                        var proposal = results[1];
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
                            var request = {
                                proposalResponses: proposalResponses,
                                proposal: proposal
                            };

                            var sendPromise = channel.sendTransaction(request);
                            promises.push(sendPromise); //we want the send transaction first, so that we know where to check status

                            console.log("Created Promise - setOverageFlag");
                        }

                        //console.log("Created eventhub - ", event_hub);
                        event_hub.connect(true);
                        console.log("connected to eventhub");
                        var regid = event_hub.registerChaincodeEvent('telco-roaming-contract', 'SetOverageFlagEvent-'+simPublicKey, function(event) {
                            console.log(`Found SetOverageFlagEvent`);
                            console.log(event);
                            console.log(util.format("Custom event received, payload: %j\n", event.payload.toString()));
                            event_hub.unregisterChaincodeEvent(regid);
                            var tx_id = client.newTransactionID(true);
                            console.log("Assigning transaction_id: ", tx_id._transaction_id); 
                            // must send the proposal to endorsing peers
                            var request = {
                                //targets: let default to the peer assigned to the client
                                chaincodeId: smartContractName,
                                fcn: 'callOut',
                                args: [simPublicKey],
                                chainId: channelName,
                                txId: tx_id
                            };
                            // send the transaction proposal to the peers
                            channel.sendTransactionProposal(request).then((results) => {
                                var proposalResponses = results[0];
                                var proposal = results[1];
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
                                    var request = {
                                        proposalResponses: proposalResponses,
                                        proposal: proposal
                                    };

                                    var sendPromise = channel.sendTransaction(request);
                                    promises.push(sendPromise); //we want the send transaction first, so that we know where to check status

                                    console.log("Created Promise - callOut");
                                }

                                //console.log("Created eventhub - ", event_hub);
                                event_hub.connect(true);
                                console.log("connected to eventhub");
                                var regid = event_hub.registerChaincodeEvent('telco-roaming-contract', 'CallOutEvent-'+simPublicKey, function(event) {
                                    console.log(`Found CallOutEvent`);
                                    console.log(event);
                                    console.log(util.format("Custom event received, payload: %j\n", event.payload.toString()));
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
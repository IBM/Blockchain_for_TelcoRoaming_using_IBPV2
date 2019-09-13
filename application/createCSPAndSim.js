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

let CSPs = [];
let SubscriberSims = [];
let callDetails = [];
CSPs.push({
    name: 'CSP_US',
    region: 'United States',
    roamingRate: '0.50',
    overageRate: '0.75'
});

CSPs.push({
    name: 'CSP_EU',
    region: 'European Union',
    roamingRate: '0.75',
    overageRate: '1.00'
});

SubscriberSims.push({
    publicKey: 'sim1',
    msisdn: '4691234577',
    address: 'United States',
    homeOperatorName: 'CSP_US',
    roamingPartnerName: '',
    isRoaming: 'FALSE',
    location: 'United States',
    latitude: '40.942746',
    longitude: '-74.91',
    roamingRate: '',
    overageRate: '',
    callDetails: callDetails,
    isValid: '',
    overageThreshold: '2.00',
    allowOverage: '',
    overageFlag: 'FALSE'
});

SubscriberSims.push({
    publicKey: 'sim2',
    msisdn: '4691234578',
    address: 'European Union',
    homeOperatorName: 'CSP_EU',
    roamingPartnerName: '',
    isRoaming: 'FALSE',
    location: 'European Union',
    latitude: '36.931',
    longitude: '-78.994838',
    roamingRate: '',
    overageRate: '',
    callDetails: callDetails,
    isValid: '',
    overageThreshold: '1.00',
    allowOverage: '',
    overageFlag: 'FALSE'
});

const gateway = new Gateway();
var promises = [];

process.on('unhandledRejection', error => {
    // Will print "unhandledRejection err is not defined"
    console.log('unhandledRejection', error.message);
    return process.exit(1);
});

async function main() {
//    if(process.argv.length != 3){
//        console.log("Process argv length is ", process.argv.length, ". It should be 3");
//        process.exit(1);
//    }
    
//    let simPublicKey = process.argv[2];

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
    let CSP_index = 0, Sim_index = 0, CSP, sim;
    CSP = CSPs[CSP_index];
    var tx_id = client.newTransactionID(true);
    console.log("Assigning transaction_id: ", tx_id._transaction_id); 
    // must send the proposal to endorsing peers
    var request = {
        //targets: let default to the peer assigned to the client
        chaincodeId: smartContractName,
        fcn: 'createCSP',
        args: [CSP.name, CSP.region, CSP.overageRate, CSP.roamingRate],
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

            console.log("Created Promise - createCSP " + CSP.name);
        }

        //console.log("Created eventhub - ", event_hub);
        event_hub.connect(true);
        console.log("connected to eventhub");
        var regid = event_hub.registerChaincodeEvent('telco-roaming-contract', 'CreateCSPEvent-'+CSP.name, function(event) {
            console.log(`Found CreateCSPEvent`);
            console.log(event);
            console.log(util.format("Custom event received, payload: %j\n", event.payload.toString()));
            event_hub.unregisterChaincodeEvent(regid);
            CSP = CSPs[++CSP_index];
            var tx_id = client.newTransactionID(true);
            console.log("Assigning transaction_id: ", tx_id._transaction_id); 
            // must send the proposal to endorsing peers
            var request = {
                //targets: let default to the peer assigned to the client
                chaincodeId: smartContractName,
                fcn: 'createCSP',
                args: [CSP.name, CSP.region, CSP.overageRate, CSP.roamingRate],
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

                    console.log("Created Promise - createCSP " + CSP.name);
                }

                //console.log("Created eventhub - ", event_hub);
                event_hub.connect(true);
                console.log("connected to eventhub");
                var regid = event_hub.registerChaincodeEvent('telco-roaming-contract', 'CreateCSPEvent-'+CSP.name, function(event) {
                    console.log(`Found CreateCSPEvent`);
                    console.log(event);
                    console.log(util.format("Custom event received, payload: %j\n", event.payload.toString()));
                    event_hub.unregisterChaincodeEvent(regid);
                    sim = SubscriberSims[Sim_index];
                    var tx_id = client.newTransactionID(true);
                    console.log("Assigning transaction_id: ", tx_id._transaction_id); 
                    // must send the proposal to endorsing peers
                    var request = {
                        //targets: let default to the peer assigned to the client
                        chaincodeId: smartContractName,
                        fcn: 'createSubscriberSim',
                        args: [sim.publicKey, sim.msisdn, sim.address, sim.homeOperatorName, sim.roamingPartnerName, sim.isRoaming, sim.location, sim.latitude, sim.longitude, sim.roamingRate, sim.overageRate, sim.callDetails, sim.isValid, sim.overageThreshold, sim.allowOverage, sim.overageFlag],
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

                            console.log("Created Promise - createSubscriberSim " + sim.publicKey);
                        }

                        //console.log("Created eventhub - ", event_hub);
                        event_hub.connect(true);
                        console.log("connected to eventhub");
                        var regid = event_hub.registerChaincodeEvent('telco-roaming-contract', 'CreateSubscriberSimEvent-'+sim.publicKey, function(event) {
                            console.log(`Found CreateSubscriberSimEvent`);
                            console.log(event);
                            console.log(util.format("Custom event received, payload: %j\n", event.payload.toString()));
                            event_hub.unregisterChaincodeEvent(regid);
                            sim = SubscriberSims[++Sim_index];
                            var tx_id = client.newTransactionID(true);
                            console.log("Assigning transaction_id: ", tx_id._transaction_id); 
                            // must send the proposal to endorsing peers
                            var request = {
                                //targets: let default to the peer assigned to the client
                                chaincodeId: smartContractName,
                                fcn: 'createSubscriberSim',
                                args: [sim.publicKey, sim.msisdn, sim.address, sim.homeOperatorName, sim.roamingPartnerName, sim.isRoaming, sim.location, sim.latitude, sim.longitude, sim.roamingRate, sim.overageRate, sim.callDetails, sim.isValid, sim.overageThreshold, sim.allowOverage, sim.overageFlag],
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

                                    console.log("Created Promise - createSubscriberSim " + sim.publicKey);
                                }

                                //console.log("Created eventhub - ", event_hub);
                                event_hub.connect(true);
                                console.log("connected to eventhub");
                                var regid = event_hub.registerChaincodeEvent('telco-roaming-contract', 'CreateSubscriberSimEvent-'+sim.publicKey, function(event) {
                                    console.log(`Found CreateSubscriberSimEvent`);
                                    console.log(event);
                                    console.log(util.format("Custom event received, payload: %j\n", event.payload.toString()));
                                    event_hub.unregisterChaincodeEvent(regid);
                                    sim = SubscriberSims[--Sim_index];
                                    var tx_id = client.newTransactionID(true);
                                    console.log("Assigning transaction_id: ", tx_id._transaction_id); 
                                    // must send the proposal to endorsing peers
                                    var request = {
                                        //targets: let default to the peer assigned to the client
                                        chaincodeId: smartContractName,
                                        fcn: 'authentication',
                                        args: [sim.publicKey],
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

                                            console.log("Created Promise - authentication " + sim.publicKey);
                                        }

                                        //console.log("Created eventhub - ", event_hub);
                                        event_hub.connect(true);
                                        console.log("connected to eventhub");
                                        var regid = event_hub.registerChaincodeEvent('telco-roaming-contract', 'AuthenticationEvent-'+sim.publicKey, function(event) {
                                            console.log(`Found AuthenticationEvent`);
                                            console.log(event);
                                            console.log(util.format("Custom event received, payload: %j\n", event.payload.toString()));
                                            event_hub.unregisterChaincodeEvent(regid);
                                            sim = SubscriberSims[++Sim_index];
                                            var tx_id = client.newTransactionID(true);
                                            console.log("Assigning transaction_id: ", tx_id._transaction_id); 
                                            // must send the proposal to endorsing peers
                                            var request = {
                                                //targets: let default to the peer assigned to the client
                                                chaincodeId: smartContractName,
                                                fcn: 'authentication',
                                                args: [sim.publicKey],
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

                                                    console.log("Created Promise - authentication " + sim.publicKey);
                                                }

                                                //console.log("Created eventhub - ", event_hub);
                                                event_hub.connect(true);
                                                console.log("connected to eventhub");
                                                var regid = event_hub.registerChaincodeEvent('telco-roaming-contract', 'AuthenticationEvent-'+sim.publicKey, function(event) {
                                                    console.log(`Found AuthenticationEvent`);
                                                    console.log(event);
                                                    console.log(util.format("Custom event received, payload: %j\n", event.payload.toString()));
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
                });
            });
        });
    });
}

main();
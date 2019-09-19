'use strict';
/*
* Copyright IBM Corp All Rights Reserved
*
* SPDX-License-Identifier: Apache-2.0
*/
/*
 * Invoke the telco-roaming-contract to create a fraudulent SubscriberSim.
 * 1. call createSubscriberSim to create sim3 (which has the same msisdn as sim1 created in CreateCSPAndSim.js)
 * 2. call authentication to authenticate sim3
 *
 * Should successfully complete without errors and the ledger should contain the SubscriberSim.
 * The SubscriberSim sim3 should have isValid = 'Fraud' as it has the same msisdn as an existing SubscriberSim.
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

let callDetails = [];

let sim = {
    publicKey: 'sim3',
    msisdn: '4691234577',
    address: 'United States',
    homeOperatorName: 'CSP_US',
    roamingPartnerName: '',
    isRoaming: 'false',
    location: 'United States',
    latitude: '40.942746',
    longitude: '-74.91',
    roamingRate: '',
    overageRate: '',
    callDetails: callDetails,
    isValid: '',
    overageThreshold: '2.00',
    allowOverage: '',
    overageFlag: 'false'
};

const gateway = new Gateway();

let promises = [];

process.on('unhandledRejection', error => {
    // Will print "unhandledRejection err is not defined"
    console.log('An unhandled rejection was found - ', error.message);
    return process.exit(1);
});

async function main() {

    // A gateway defines the peers used to access Fabric networks

    await gateway.connect(ccp, { wallet, identity: appAdmin , discovery: {enabled: gatewayDiscoveryEnabled, asLocalhost:gatewayDiscoveryAsLocalhost }});
    // eslint-disable-next-line no-unused-vars
    const network = await gateway.getNetwork(channelName);
    const client = gateway.getClient();
    const channel = client.getChannel(channelName);

    let event_hub = channel.newChannelEventHub(peerAddr);
    let tx_id = client.newTransactionID(true);
    let fcn = 'createSubscriberSim';
    console.log(`Sending transaction proposal for ${fcn} with transaction id ${tx_id._transaction_id}`);
    // must send the proposal to endorsing peers
    let request = {
        //targets: let default to the peer assigned to the client
        chaincodeId: smartContractName,
        fcn: fcn,
        args: [sim.publicKey, sim.msisdn, sim.address, sim.homeOperatorName, sim.roamingPartnerName, sim.isRoaming, sim.location, sim.latitude, sim.longitude, sim.roamingRate, sim.overageRate, sim.callDetails, sim.isValid, sim.overageThreshold, sim.allowOverage, sim.overageFlag],
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

            console.log(`Created Promise - ${fcn} for ` + sim.publicKey);
        }

        //console.log("Created eventhub - ", event_hub);
        event_hub.connect(true);
        //console.log("connected to eventhub");
        let regid = event_hub.registerChaincodeEvent('telco-roaming-contract', 'CreateSubscriberSimEvent-'+sim.publicKey, function() {
            console.log('Found CreateSubscriberSimEvent');
            //console.log(event);
            //console.log(util.format("Custom event received, payload: %j\n", event.payload.toString()));
            event_hub.unregisterChaincodeEvent(regid);
            let tx_id = client.newTransactionID(true);
            fcn = 'authentication';
            console.log(`Sending transaction proposal for ${fcn} with transaction id ${tx_id._transaction_id}`);

            // must send the proposal to endorsing peers
            let request = {
                //targets: let default to the peer assigned to the client
                chaincodeId: smartContractName,
                fcn: fcn,
                args: [sim.publicKey],
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

                    console.log(`Created Promise - ${fcn} for ` + sim.publicKey);
                }

                //console.log("Created eventhub - ", event_hub);
                event_hub.connect(true);
                //console.log("connected to eventhub");
                let regid = event_hub.registerChaincodeEvent('telco-roaming-contract', 'AuthenticationEvent-'+sim.publicKey, function() {
                    console.log('Found AuthenticationEvent');
                    //console.log(event);
                    //console.log(util.format("Custom event received, payload: %j\n", event.payload.toString()));
                    event_hub.unregisterChaincodeEvent(regid);
                    return process.exit(0);
                });
            });
        });
    });
}

main();
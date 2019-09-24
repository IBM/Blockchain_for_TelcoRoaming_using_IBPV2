'use strict';
/*
* Copyright IBM Corp All Rights Reserved
*
* SPDX-License-Identifier: Apache-2.0
*/
/*
 * Invoke the telco-roaming-contract to end a call and calculate the call charges.
 * node callEnd.js <simPublicKey>
 * eg. node callEnd.js sim1
 *
 *
 * 1. call callEnd - to end the ongoing call.
 * 2. call callPay - to calculate the call charges.
 *
 * Assumptions: Ideally, as in case of callOut.js, a call would require the sim_id/msisdn to which the call is being made, but for simplicity we are ignoring that for now and simply trying to end the currently ongoing call (the last call added to the array of calls for the sim).
 *
 * An error is thrown at step 1 if no ongoing call is found.
 * Otherwise, the call is ended; the end time for the call is saved.
 * Step 3 makes use of the duration of the call and the calling rate (which is the roaming rate if the user has not reached overage limits and the overage rate if they have crossed the overage limits) to calculate the charges for this call which is then  saved in the ledger.
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
    let fcn = 'callEnd';
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
        let regid = event_hub.registerChaincodeEvent('telco-roaming-contract', 'CallEndEvent-'+simPublicKey, function(event) {
            console.log('Found CallEndEvent');
            //console.log(event);
            //console.log(util.format("Custom event received, payload: %j\n", event.payload.toString()));
            let callDetailIndex = JSON.parse(event.payload.toString()).callDetailIndex;
            event_hub.unregisterChaincodeEvent(regid);
            // get a transaction id object based on the current user assigned to fabric client
            tx_id = client.newTransactionID(true);
            fcn = 'callPay';
            console.log(`Sending transaction proposal for ${fcn} with transaction id ${tx_id._transaction_id}`);
            // must send the proposal to endorsing peers
            request = {
                //targets: let default to the peer assigned to the client
                chaincodeId: smartContractName,
                fcn: fcn,
                args: [simPublicKey, callDetailIndex.toString()],
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
                let regid = event_hub.registerChaincodeEvent('telco-roaming-contract', 'CallPayEvent-'+simPublicKey, function() {
                    console.log('Found CallPayEvent');
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
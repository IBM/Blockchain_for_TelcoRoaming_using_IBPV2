/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

//import Hyperledger Fabric 1.4 SDK
const { Contract } = require('fabric-contract-api');
const path = require('path');
const fs = require('fs');

//import files containing constructors
const CSP = require('./CSP.js');
const SubscriberSim = require('./SubscriberSim.js');

class TelcoRoamingContract extends Contract {

    constructor(){
        super('TelcoRoamingContract');
    }
    /**
     *
     * instantiate
     *
     * This function creates CSPs and SubscriberSims using the data files in the data dictionary 
     * and gets the application ready for use.
     * 
     * @param ctx - the context of the transaction
     * @returns - nothing - but updates the world state with the CSPs and SubscriberSims
     */

    async instantiate(ctx) {

        console.log('instantiate was called');

        let CSPs = [];
        let subscriberSims = [];

        //create CSPs
        let csp1 = await new CSP('AT&T', 'New York', '0.50', '0.75');
        let csp2 = await new CSP('T-Mobile', 'Washington DC', '0.75', '0.25');
        let csp3 = await new CSP('Verizon', 'Boston', '0.25', '1.00');

        //update CSP array
        CSPs.push(csp1);
        CSPs.push(csp2);
        CSPs.push(csp3);

        //add the CSPs to the world state 
        await ctx.stub.putState(csp1.name, Buffer.from(JSON.stringify(csp1)));
        await ctx.stub.putState(csp2.name, Buffer.from(JSON.stringify(csp2)));
        await ctx.stub.putState(csp3.name, Buffer.from(JSON.stringify(csp3)));

        //create SubscriberSims
        let sim1 = await new SubscriberSim("sim1","4691234567","New York","AT&T","","FALSE","New York","40.942746", "-74.91","","");
        let sim2 = await new SubscriberSim("sim2","4691234568","New York","AT&T","","FALSE","New York","36.931", "-78.994838","","");
        let sim3 = await new SubscriberSim("sim3","4691234569","Washington DC","T-Mobile","","FALSE","Washington DC","37.776", "-77.414","","");
        let sim4 = await new SubscriberSim("sim4","3097218855","Washington DC","T-Mobile","","FALSE","Washington DC","38.50", "-75.678","","");
        let sim5 = await new SubscriberSim("sim5","9091234567","Washington DC","T-Mobile","","FALSE","Washington DC", "40.145", "-71.6574","","");
        let sim6 = await new SubscriberSim("sim6","9091234568","Boston","Verizon","","FALSE","Boston", "41.3851", "-78.345","","");

        //update SubscriberSims array
        subscriberSims.push(sim1);
        subscriberSims.push(sim2);
        subscriberSims.push(sim3);
        subscriberSims.push(sim4);
        subscriberSims.push(sim5);
        subscriberSims.push(sim6);

        //add the SubscriberSims to the world state 
        await ctx.stub.putState(sim1.publicKey, Buffer.from(JSON.stringify(sim1)));
        await ctx.stub.putState(sim2.publicKey, Buffer.from(JSON.stringify(sim2)));
        await ctx.stub.putState(sim3.publicKey, Buffer.from(JSON.stringify(sim3)));
        await ctx.stub.putState(sim4.publicKey, Buffer.from(JSON.stringify(sim4)));
        await ctx.stub.putState(sim5.publicKey, Buffer.from(JSON.stringify(sim5)));
        await ctx.stub.putState(sim6.publicKey, Buffer.from(JSON.stringify(sim6)));

        console.log("CSPs and Subscriber sims have been instantiated");
    }

    async addSim(ctx, publicKey, msisdn, address, homeOperatorName, roamingPartnerName, 
              isRoaming, location, latitude, longitude, ratetype, isValid){

        const buffer1 = await ctx.stub.getState(homeOperatorName);
        const buffer2 = await ctx.stub.getState(roamingPartnerName);
        if (!buffer1) {
            console.log('The home operator CSP does not exist. Please specify a valid home operator CSP.');
            throw new Error ('The home operator CSP does not exist. Please specify a valid home operator CSP.');
        }
        else if (!buffer2) {
            console.log('The roaming partner CSP does not exist. Please specify a valid roaming partner CSP.');
            throw new Error ('The roaming partner CSP does not exist. Please specify a valid roaming partner CSP.');
        }
        else{
            let sim = await new SubscriberSim(publicKey, msisdn, address, homeOperatorName, roamingPartnerName, 
              isRoaming, location, latitude, longitude, ratetype, isValid);
            return sim;
        }  
    }
}
module.exports = TelcoRoamingContract;
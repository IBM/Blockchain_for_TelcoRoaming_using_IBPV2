/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Contract } = require('fabric-contract-api');

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
        console.log(CSPs);

        //add CSPs to world state
        await ctx.stub.putState(csp1.name, Buffer.from(JSON.stringify(csp1)));
        await ctx.stub.putState(csp2.name, Buffer.from(JSON.stringify(csp2)));
        await ctx.stub.putState(csp3.name, Buffer.from(JSON.stringify(csp3)));

        //create SubscriberSims
        let sim1 = await new SubscriberSim('sim1','4691234567','New York','AT&T','','FALSE','New York','40.942746', '-74.91','','');
        let sim2 = await new SubscriberSim('sim2','4691234568','New York','AT&T','','FALSE','New York','36.931', '-78.994838','','');
        let sim3 = await new SubscriberSim('sim3','4691234569','Washington DC','T-Mobile','','FALSE','Washington DC','37.776', '-77.414','','');
        let sim4 = await new SubscriberSim('sim4','3097218855','Washington DC','T-Mobile','','FALSE','Washington DC','38.50', '-75.678','','');
        let sim5 = await new SubscriberSim('sim5','9091234567','Washington DC','T-Mobile','','FALSE','Washington DC', '40.145', '-71.6574','','');
        let sim6 = await new SubscriberSim('sim6','9091234568','Boston','Verizon','AT&T','FALSE','Boston', '41.3851', '-78.345','','');

        //update SubscriberSims array
        subscriberSims.push(sim1);
        subscriberSims.push(sim2);
        subscriberSims.push(sim3);
        subscriberSims.push(sim4);
        subscriberSims.push(sim5);
        subscriberSims.push(sim6);
        console.log(subscriberSims);

        //add SubscriberSims to world state
        await ctx.stub.putState(sim1.publicKey, Buffer.from(JSON.stringify(sim1)));
        await ctx.stub.putState(sim2.publicKey, Buffer.from(JSON.stringify(sim2)));
        await ctx.stub.putState(sim3.publicKey, Buffer.from(JSON.stringify(sim3)));
        await ctx.stub.putState(sim4.publicKey, Buffer.from(JSON.stringify(sim4)));
        await ctx.stub.putState(sim5.publicKey, Buffer.from(JSON.stringify(sim5)));
        await ctx.stub.putState(sim6.publicKey, Buffer.from(JSON.stringify(sim6)));

        console.log('CSPs and Subscriber sims have been instantiated');
    }

    async assetExists(ctx, assetId) {
        console.log('checking if ',assetId, ' exists');
        let buffer = await ctx.stub.getState(assetId);
        return (!!buffer && buffer.length > 0);
    }

    async createCSP(ctx, name, region, overageRate, roamingRate) {
        console.log('Trying to create CSP ', name);
        let exists = await this.assetExists(ctx, name);
        if (exists) {
            throw new Error(`The CSP ${name} already exists`);
        }
        console.log(name, ' does not exist. Creating...');

        let newCSP = await new CSP(name, region, overageRate, roamingRate);
        await ctx.stub.putState(name, Buffer.from(JSON.stringify(newCSP)));
        console.log('returning from ', name);
        //return csp;
    }

    async createSubscriberSim(ctx, publicKey, msisdn, address, homeOperatorName, roamingPartnerName,
        isRoaming, location, latitude, longitude, ratetype, isValid) {
        //verify that the subscriberSim doesn't already exist
        let exists = await this.assetExists(ctx, publicKey);
        if (exists) {
            throw new Error(`The subscriber sim ${publicKey} already exists`);
        }

        //verify that the homeOperator CSP is already created
        let HOexists = await this.assetExists(ctx, homeOperatorName);
        console.log('HOExists',HOexists);
        if (!HOexists) {
            throw new Error(`The home operator CSP ${homeOperatorName} does not exist`);
        }

        //verify that the roamingPartner CSP is already created
        if(roamingPartnerName) {
            let RPexists = await this.assetExists(ctx, roamingPartnerName);
            if (!RPexists) {
                throw new Error(`The roamingPartner CSP ${roamingPartnerName} does not exist`);
            }
        }
        let sim = await new SubscriberSim(publicKey, msisdn, address, homeOperatorName, roamingPartnerName,
            isRoaming, location, latitude, longitude, ratetype, isValid);
        await ctx.stub.putState(publicKey, Buffer.from(JSON.stringify(sim)));
    }

    async readAsset(ctx, assetId) {
        let exists = await this.assetExists(ctx, assetId);
        if (!exists) {
            throw new Error(`The asset ${assetId} does not exist`);
        }

        let buffer = await ctx.stub.getState(assetId);
        let asset = JSON.parse(buffer.toString());

        return asset;
    }

    async updateCSP(ctx, name, region, overageRate, roamingRate) {
        let exists = await this.assetExists(ctx, name);
        if (!exists) {
            throw new Error(`The CSP ${name} does not exist`);
        }

        let csp = await new CSP(name, region, overageRate, roamingRate);
        await ctx.stub.putState(name, Buffer.from(JSON.stringify(csp)));
    }

    async updateSubscriberSim(ctx, publicKey, msisdn, address, homeOperatorName, roamingPartnerName,
        isRoaming, location, latitude, longitude, ratetype, isValid) {
        let exists = await this.assetExists(ctx, publicKey);
        if (!exists) {
            throw new Error(`The subscriber sim ${publicKey} does not exist`);
        }

        //verify that the homeOperator CSP is already created
        let HOexists = await this.assetExists(ctx, homeOperatorName);
        console.log('HOExists',HOexists);
        if (!HOexists) {
            throw new Error(`The home operator CSP ${homeOperatorName} does not exist`);
        }

        //verify that the roamingPartner CSP is already created
        if(roamingPartnerName) {
            let RPexists = await this.assetExists(ctx, roamingPartnerName);
            if (!RPexists) {
                throw new Error(`The roamingPartner CSP ${roamingPartnerName} does not exist`);
            }
        }

        let sim = await new SubscriberSim(publicKey, msisdn, address, homeOperatorName, roamingPartnerName,
            isRoaming, location, latitude, longitude, ratetype, isValid);
        await ctx.stub.putState(publicKey, Buffer.from(JSON.stringify(sim)));
    }

    async deleteCSP(ctx, name) {
        let exists = await this.assetExists(ctx, name);
        if (!exists) {
            throw new Error(`The CSP ${name} does not exist`);
        }
        //if CSP exists, verify that no subscriber sims are associated with it before deleting the CSP
        let queryResults = await this.findAllSubscriberSimsForCSP(ctx, name);
        if (queryResults.length > 0){
            throw new Error(`The CSP ${name} can not be deleted as the following sims are currently in its network: ${queryResults}`);
        }
        await ctx.stub.deleteState(name);
    }

    async deleteSubscriberSim(ctx, publicKey) {
        let exists = await this.assetExists(ctx, publicKey);
        if (!exists) {
            throw new Error(`The subscriber sim ${publicKey} does not exist`);
        }
        await ctx.stub.deleteState(publicKey);
    }

    //TODO: probably the latitude and longitude will also get updated - leave it for other devs?
    //Once moveSim occurs, discovery transaction is invoked
    async moveSim(ctx, simPublicKey, newLocation){
        let exists = await this.assetExists(ctx, simPublicKey);
        if (!exists) {
            throw new Error(`The asset ${simPublicKey} does not exist`);
        }
        let buffer = await ctx.stub.getState(simPublicKey);
        let asset = JSON.parse(buffer.toString());
        let sim = await new SubscriberSim(simPublicKey, asset.msisdn, asset.address, asset.homeOperatorName, asset.roamingPartnerName,
            asset.isRoaming, newLocation, asset.latitude, asset.longitude, asset.ratetype, asset.isValid);
        await ctx.stub.putState(simPublicKey, Buffer.from(JSON.stringify(sim)));
        buffer = await ctx.stub.getState(simPublicKey);
        asset = JSON.parse(buffer.toString());
        // define and set moveEvent
        let moveEvent = {
            type: 'Move Sim',
            simPublicKey: simPublicKey,
            roamingPartner: asset.roamingPartnerName,
            homeOperator: asset.homeOperatorName,
            location: newLocation
        };
        ctx.stub.setEvent('MoveEvent', Buffer.from(JSON.stringify(moveEvent)));
    }

    //Once discovery occurs, authentication transaction is invoked
    async discovery(ctx, simPublicKey){
        //get currentLocation of the sim.
        //If it is different from homeOperator's location, find the CSP for this location.
        //If same and isRoaming is true, then sim is back to home location - so reset
        let returnValue;
        //get sim object
        let exists = await this.assetExists(ctx, simPublicKey);
        if (!exists) {
            throw new Error(`The asset ${simPublicKey} does not exist`);
        }
        let buffer = await ctx.stub.getState(simPublicKey);
        let sim = JSON.parse(buffer.toString());

        //get Home Operator Object
        exists = await this.assetExists(ctx, sim.homeOperatorName);
        if (!exists) {
            throw new Error(`The sim's home operator ${sim.homeOperatorName} does not exist`);
        }
        buffer = await ctx.stub.getState(sim.homeOperatorName);
        let HO = JSON.parse(buffer.toString());

        //check if sim has moved out of home operator's region.
        //if yes, find the operators for this region to figure out who the roaming provider will be.
        if (HO.region!==sim.location){
            //sim has moved out of the HO's area
            //find the applicable roamingPartner
            let queryString = {
                selector: {
                    type: 'CSP',
                    region: sim.location
                }
            };

            let queryResults = await this.queryWithQueryString(ctx, JSON.stringify(queryString));
            let operators = [];

            queryResults.forEach(function(queryResult){
                operators.push(queryResult.Key);
            });
            console.info('List of operators in this area: ', JSON.stringify(operators));
            if(operators.length>0){
                //let RPname = operators[0];
                //await this.updateRate(ctx, sim, RPname);

                returnValue = operators[0];
            }
            else{
                console.err('No operators in this location');
            }
        }
        else{
            //sim is back in home operator location. Call updateRate with homeOperator's name
            //await this.updateRate(ctx, sim, HO.name);
            returnValue = HO.name;
        }
        if(returnValue !== null){
            // define and set moveEvent
            let discoveryEvent = {
                type: 'Discover Sim',
                simPublicKey: simPublicKey,
                localOperator: returnValue
            };
            await ctx.stub.setEvent('DiscoveryEvent', Buffer.from(JSON.stringify(discoveryEvent)));
        }
    }

    //TODO: The CSP will make an authentication call to verify the user is not a fraud
    //once verified, call updateRate
    async authentication(ctx, simPublicKey){
        //do nothing for now
        //create event so that updateRate is triggered
        let authenticationEvent = {
            type: 'Authenticate Sim',
            simPublicKey: simPublicKey
        };
        await ctx.stub.setEvent('AuthenticationEvent', Buffer.from(JSON.stringify(authenticationEvent)));
    }

    //called after authentication completes
    async updateRate(ctx, simPublicKey, RPname){
        let exists = await this.assetExists(ctx, simPublicKey);
        if (!exists) {
            throw new Error(`The asset ${simPublicKey} does not exist`);
        }
        let buffer = await ctx.stub.getState(simPublicKey);
        let sim = JSON.parse(buffer.toString());

        let newSim;
        if (sim.homeOperatorName === RPname && sim.isRoaming === 'TRUE'){
            newSim = await new SubscriberSim(sim.publicKey, sim.msisdn, sim.address, sim.homeOperatorName, '',
                'FALSE', sim.location, sim.latitude, sim.longitude, '', sim.isValid);
        }
        else if (sim.homeOperatorName !== RPname){
            let exists = await this.assetExists(ctx, RPname);
            if (!exists) {
                throw new Error(`The asset ${RPname} does not exist`);
            }
            let buffer = await ctx.stub.getState(RPname);
            let RP = JSON.parse(buffer.toString());
            newSim = await new SubscriberSim(sim.publicKey, sim.msisdn, sim.address, sim.homeOperatorName, RP.name,
                'TRUE', sim.location, sim.latitude, sim.longitude, RP.roamingRate, sim.isValid);
        }
        await ctx.stub.putState(sim.publicKey, Buffer.from(JSON.stringify(newSim)));
        buffer = await ctx.stub.getState(sim.publicKey);
        let asset = JSON.parse(buffer.toString());
        // define and set moveEvent
        let updateRateEvent = {
            type: 'UpdateRate Sim',
            simPublicKey: simPublicKey,
            homeOperator: asset.homeOperatorName,
            isRoaming: asset.isRoaming,
            roamingPartner: asset.roamingPartnerName,
            roamingRate: asset.roamingRate
        };
        await ctx.stub.setEvent('UpdateRateEvent', Buffer.from(JSON.stringify(updateRateEvent)));
    }

    /**
     * Query and return all key value pairs in the world state.
     *
     * @param {Context} ctx the transaction context
     * @returns - all key-value pairs in the world state
     */
    async queryAll(ctx) {

        let queryString = {
            selector: {}
        };

        let queryResults = await this.queryWithQueryString(ctx, JSON.stringify(queryString));
        return queryResults;

    }

    /**
     * Evaluate a queryString
     *
     * @param {Context} ctx the transaction context
     * @param {String} queryString the query string to be evaluated
    */
    async queryWithQueryString(ctx, queryString) {

        console.log('query String');
        console.log(JSON.stringify(queryString));

        let resultsIterator = await ctx.stub.getQueryResult(queryString);

        let allResults = [];

        // eslint-disable-next-line no-constant-condition
        while (true) {
            let res = await resultsIterator.next();

            if (res.value && res.value.value.toString()) {
                let jsonRes = {};

                console.log(res.value.value.toString('utf8'));

                jsonRes.Key = res.value.key;

                try {
                    jsonRes.Record = JSON.parse(res.value.value.toString('utf8'));
                } catch (err) {
                    console.log(err);
                    jsonRes.Record = res.value.value.toString('utf8');
                }

                allResults.push(jsonRes);
            }
            if (res.done) {
                console.log('end of data');
                await resultsIterator.close();
                console.info(allResults);
                return allResults;
            }
        }
    }

    /**
     * Query by the main objects in this app: ballot, election, votableItem, and Voter.
     * Return all key-value pairs of a given type.
     *
     * @param {Context} ctx the transaction context
     * @param {String} objectType the type of the object - should be either ballot, election, votableItem, or Voter
     */
    async findAllSubscriberSimsForCSP(ctx, cspName) {

        let queryString = {
            selector: {
                type: 'SubscriberSim',
                $or: [
                    {
                        homeOperatorName: cspName
                    },
                    {
                        roamingPartnerName: cspName
                    }
                ]
            }
        };

        let queryResults = await this.queryWithQueryString(ctx, JSON.stringify(queryString));
        let simsForCSP = [];

        // eslint-disable-next-line no-constant-condition
        queryResults.forEach(function(queryResult){
            simsForCSP.push(queryResult.Key);
        });
        console.info('List of sims related to this CSP: ', JSON.stringify(simsForCSP));
        return simsForCSP;
    }

}

module.exports = TelcoRoamingContract;
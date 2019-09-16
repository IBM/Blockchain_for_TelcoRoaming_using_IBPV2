/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Contract } = require('fabric-contract-api');

//import files containing constructors
const CSP = require('./CSP.js');
const SubscriberSim = require('./SubscriberSim.js');
const CallDetails = require('./CallDetails.js');

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

        /*console.log('instantiate was called');

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

        let callDetails = [];

        //create SubscriberSims
        let sim1 = await new SubscriberSim('sim1','4691234567','New York','AT&T','','FALSE','New York','40.942746', '-74.91','',callDetails, '');
        let sim2 = await new SubscriberSim('sim2','4691234568','New York','AT&T','','FALSE','New York','36.931', '-78.994838','',callDetails, '');
        let sim3 = await new SubscriberSim('sim3','4691234569','Washington DC','T-Mobile','','FALSE','Washington DC','37.776', '-77.414','',callDetails, '');
        let sim4 = await new SubscriberSim('sim4','3097218855','Washington DC','T-Mobile','','FALSE','Washington DC','38.50', '-75.678','',callDetails, '');
        let sim5 = await new SubscriberSim('sim5','9091234567','Washington DC','T-Mobile','','FALSE','Washington DC', '40.145', '-71.6574','',callDetails, '');
        let sim6 = await new SubscriberSim('sim6','9091234568','Boston','Verizon','AT&T','FALSE','Boston', '41.3851', '-78.345','',callDetails, '');

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

        await this.authentication(ctx, sim1.publicKey);
        await this.authentication(ctx, sim2.publicKey);
        await this.authentication(ctx, sim3.publicKey);
        await this.authentication(ctx, sim4.publicKey);
        await this.authentication(ctx, sim5.publicKey);
        await this.authentication(ctx, sim6.publicKey);
        console.log('Subscriber sims have been authenticated');*/
    }

    /**
     *
     * assetExists
     *
     * This function checks if a CSP/SubscriberSim exists.
     *
     * @param ctx - the context of the transaction
     * @param assetId - name in case of a CSP and publicKey in case of a SubscriberSim
     * @returns - true if the asset exists and false if the asset does not exist
     */
    async assetExists(ctx, assetId) {
        console.log('checking if ',assetId, ' exists');
        let buffer = await ctx.stub.getState(assetId);
        return (!!buffer && buffer.length > 0);
    }

    /**
     *
     * readAsset
     *
     * This function reads and returns the asset identified by assetId .
     *
     * @param ctx - the context of the transaction
     * @param assetId - name in case of a CSP and publicKey in case of a SubscriberSim
     * @returns - the asset in JSON object form, if it exists, otherwise it throws an error
     */
    async readAsset(ctx, assetId) {
        let exists = await this.assetExists(ctx, assetId);
        if (!exists) {
            throw new Error(`The asset ${assetId} does not exist`);
        }

        let buffer = await ctx.stub.getState(assetId);
        let asset = JSON.parse(buffer.toString());

        return asset;
    }

    /**
     *
     * createCSP
     *
     * This function creates a new CSP.
     *
     * @param ctx - the context of the transaction
     * @param name - the name of the CSP
     * @param region - the region for the CSP
     * @param overageRate - the overageRate charged by the CSP
     * @param roamingRate - the roamingRate charged by the CSP
     * @returns - nothing - but updates the world state with the CSP
     */
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

        // define and set createCSPEvent
        let createCSPEvent = {
            type: 'Create CSP',
            cspName: name
        };
        ctx.stub.setEvent('CreateCSPEvent-'+name, Buffer.from(JSON.stringify(createCSPEvent)));
        //return csp;
    }

    /**
     *
     * createSubscriberSim
     *
     * This function creates a new SubscriberSim.
     *
     * @param ctx - the context of the transaction
     * @param publicKey - the publicKey for the SubscriberSim
     * @param msisdn - the msisdn for the SubscriberSim
     * @param address - the home address of the SubscriberSim
     * @param homeOperatorName - the name of the home operator of the SubscriberSim
     * @param roamingPartnerName - the name of the roaming partner of the SubscriberSim
     * @param isRoaming - the flag that indicates if the SubscriberSim is currently roaming
     * @param location - the location for the SubscriberSim
     * @param latitude - the latitude for the SubscriberSim (not being updated in the code currently - ideally will be updated every time the sim moves to a new location (see this.moveSim()))
     * @param longitude - the longitude for the SubscriberSim (not being updated in the code currently - ideally will be updated every time the sim moves to a new location (see this.moveSim()))
     * @param roamingRate - the call rate used for all roaming calls made by the SubscriberSim
     * @param overageRate - the call rate used for all roaming calls made by the SubscriberSim when it has crossed the overageThreshold
     * @param callDetails - the list of all calls made by the SubscriberSim - refer CallDetails.js for details
     * @param isValid - the flag that indicates if the SubscriberSim is an Active user or a Fraud user
     * @param overageThreshold - if the sum of all call charges made by the SubscriberSim is nearing this threshold, then the overageRate will be applied to future calls instead of the roamingRate
     * @param allowOverage - the flag that indicates if the SubscriberSim agrees for the overageRate to be applied for future calls. No calls will be allowed if the SubscriberSim disagrees - that is if the allowOverage is FALSE
     * @param overageFlag - the flag that indicates if this SubscriberSim has reached the overageThreshold
     * @returns - nothing - but updates the world state with the SubscriberSim
     */
    async createSubscriberSim(ctx, publicKey, msisdn, address, homeOperatorName, roamingPartnerName,
        isRoaming, location, latitude, longitude, roamingRate, overageRate, callDetails, isValid, overageThreshold, allowOverage, overageFlag) {
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
            isRoaming, location, latitude, longitude, roamingRate, overageRate, callDetails, isValid, overageThreshold, allowOverage, overageFlag);
        await ctx.stub.putState(publicKey, Buffer.from(JSON.stringify(sim)));

        // define and set createCSPEvent
        let createSubscriberSimEvent = {
            type: 'Create SubscriberSim',
            simPublicKey: publicKey
        };
        ctx.stub.setEvent('CreateSubscriberSimEvent-'+publicKey, Buffer.from(JSON.stringify(createSubscriberSimEvent)));
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
        isRoaming, location, latitude, longitude, roamingRate, overageRate, callDetails, isValid, overageThreshold, allowOverage, overageFlag) {
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
            isRoaming, location, latitude, longitude, roamingRate, overageRate, callDetails, isValid, overageThreshold, allowOverage, overageFlag);
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

    //TODO: ideally the latitude and longitude will also get updated - that is being left for other developers to work on
    //Once moveSim occurs, discovery transaction is invoked
    async moveSim(ctx, simPublicKey, newLocation){
        let exists = await this.assetExists(ctx, simPublicKey);
        if (!exists) {
            throw new Error(`The asset ${simPublicKey} does not exist`);
        }
        let buffer = await ctx.stub.getState(simPublicKey);
        let asset = JSON.parse(buffer.toString());
        let sim = await new SubscriberSim(simPublicKey, asset.msisdn, asset.address, asset.homeOperatorName, asset.roamingPartnerName,
            asset.isRoaming, newLocation, asset.latitude, asset.longitude, asset.roamingRate, asset.overageRate, asset.callDetails, asset.isValid, asset.overageThreshold, asset.allowOverage, asset.overageFlag);
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
        ctx.stub.setEvent('MoveEvent-'+simPublicKey, Buffer.from(JSON.stringify(moveEvent)));
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
                console.error('No operators in this location');
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
            await ctx.stub.setEvent('DiscoveryEvent-'+simPublicKey, Buffer.from(JSON.stringify(discoveryEvent)));
        }
    }

    //once user is authenticated, call updateRate
    async authentication(ctx, simPublicKey){
        let exists = await this.assetExists(ctx, simPublicKey);
        if (!exists) {
            throw new Error(`The asset ${simPublicKey} does not exist`);
        }
        let buffer = await ctx.stub.getState(simPublicKey);
        let currentSim = JSON.parse(buffer.toString());

        let queryString = {
            selector: {
                type: 'SubscriberSim',
                isValid: 'Active',
                publicKey: {
                    $nin: [simPublicKey]
                },
                msisdn: currentSim.msisdn
            }
        };
        let queryResults = await this.queryWithQueryString(ctx, JSON.stringify(queryString));
        console.log(queryResults);
        if (queryResults.length > 0){
            currentSim.isValid = 'Fraud';
        }
        else{
            currentSim.isValid = 'Active';
        }
        /*let sims = [];
        queryResults.forEach(function(queryResult){
            sims.push(queryResult.Record);
        });
        let fraud = 0;
        sims.forEach(function(sim){
            //sim is Active
            if(sim.msisdn === currentSim.msisdn && sim.isValid !== ''){
                fraud = 1;
            }
        });
        if(fraud === 1){
            currentSim.isValid = 'Fraud';
        }
        else{
            currentSim.isValid = 'Active';
        }*/
        await ctx.stub.putState(simPublicKey, Buffer.from(JSON.stringify(currentSim)));

        //create event so that updateRate is triggered
        let authenticationEvent = {
            type: 'Authenticate Sim',
            isValid: currentSim.isValid,
            simPublicKey: simPublicKey
        };
        await ctx.stub.setEvent('AuthenticationEvent-'+simPublicKey, Buffer.from(JSON.stringify(authenticationEvent)));
    }

    //called after authentication completes
    async updateRate(ctx, simPublicKey, RPname){
        let exists = await this.assetExists(ctx, simPublicKey);
        if (!exists) {
            throw new Error(`The asset ${simPublicKey} does not exist`);
        }
        let buffer = await ctx.stub.getState(simPublicKey);
        let sim = JSON.parse(buffer.toString());
        if(sim.isValid === 'Fraud'){
            throw new Error(`This user ${simPublicKey} has been marked as fraudulent because the msisdn specified by this user is already in use. No calls can be made by this user.`);
        }
        let newSim;
        //user has moved back to home location
        if (sim.homeOperatorName === RPname && sim.isRoaming === 'TRUE'){
            /*sim.roamingPartnerName = '';
            sim.isRoaming = 'FALSE';
            sim.roamingRate = '';
            await ctx.stub.putState(simPublicKey, Buffer.from(JSON.stringify(sim)));*/
            newSim = await new SubscriberSim(sim.publicKey, sim.msisdn, sim.address, sim.homeOperatorName, '',
                'FALSE', sim.location, sim.latitude, sim.longitude, '', '', sim.callDetails, sim.isValid, sim.overageThreshold, sim.allowOverage, sim.overageFlag);
        }
        else if (sim.homeOperatorName !== RPname){
            let exists = await this.assetExists(ctx, RPname);
            if (!exists) {
                throw new Error(`The asset ${RPname} does not exist`);
            }
            let buffer = await ctx.stub.getState(RPname);
            let RP = JSON.parse(buffer.toString());
            newSim = await new SubscriberSim(sim.publicKey, sim.msisdn, sim.address, sim.homeOperatorName, RP.name,
                'TRUE', sim.location, sim.latitude, sim.longitude, RP.roamingRate, RP.overageRate, sim.callDetails, sim.isValid, sim.overageThreshold, sim.allowOverage, sim.overageFlag);
        }
        await ctx.stub.putState(sim.publicKey, Buffer.from(JSON.stringify(newSim)));
        buffer = await ctx.stub.getState(sim.publicKey);
        let asset = JSON.parse(buffer.toString());
        // define and set updateRate event
        let updateRateEvent = {
            type: 'UpdateRate Sim',
            simPublicKey: simPublicKey,
            homeOperator: asset.homeOperatorName,
            isRoaming: asset.isRoaming,
            roamingPartner: asset.roamingPartnerName,
            roamingRate: asset.roamingRate
        };
        await ctx.stub.setEvent('UpdateRateEvent-'+simPublicKey, Buffer.from(JSON.stringify(updateRateEvent)));
    }

    async verifyUser(ctx, simPublicKey){
        if(await this.checkIfFraudUser(ctx, simPublicKey)){
            throw new Error(`This user ${simPublicKey} has been marked as fraudulent because the msisdn specified by this user is already in use. No calls can be made by this user.`);
        }
        let overageFlags = await this.checkForOverage(ctx, simPublicKey);
        // define and set callOutEvent
        let verifyUserEvent = {
            type: 'Verify User',
            simPublicKey: simPublicKey,
            nearingOverage: overageFlags[0],
            allowOverage: overageFlags[1]
        };
        ctx.stub.setEvent('VerifyUserEvent-' + simPublicKey, Buffer.from(JSON.stringify(verifyUserEvent)));

    }

    async checkIfFraudUser(ctx, simPublicKey){
        let exists = await this.assetExists(ctx, simPublicKey);
        if (!exists) {
            throw new Error(`The asset ${simPublicKey} does not exist`);
        }
        let buffer = await ctx.stub.getState(simPublicKey);
        let asset = JSON.parse(buffer.toString());
        if(asset.isValid === 'Fraud'){
            //throw new Error(`This user ${simPublicKey} has been marked as fraudulent because the msisdn specified by this user is already in use. No calls can be made by this user.`);
            return true;
        }
        return false;
    }

    async checkForOverage(ctx, simPublicKey){
        let exists = await this.assetExists(ctx, simPublicKey);
        if (!exists) {
            throw new Error(`The asset ${simPublicKey} does not exist`);
        }
        let buffer = await ctx.stub.getState(simPublicKey);
        let asset = JSON.parse(buffer.toString());
        if(asset.overageFlag === 'TRUE'){
            return [asset.overageFlag, asset.allowOverage];
        }
        let callDetails = asset.callDetails;
        let totalCallCharges = 0;
        callDetails.forEach(function(callDetail){
            totalCallCharges = totalCallCharges + parseFloat(callDetail.callCharges);
        });
        if (totalCallCharges + parseFloat(asset.roamingRate) > parseFloat(asset.overageThreshold)){
            //reaching overage
            //set the overageFlag to true to indicate that reaching overage
            asset.overageFlag = 'TRUE';
            await ctx.stub.putState(simPublicKey, Buffer.from(JSON.stringify(asset)));
            return ['TRUE', asset.allowOverage];
        }
        else{
            //not reaching overage threshold
            return [asset.overageFlag, asset.allowOverage];
        }
    }

    async setOverageFlag(ctx, simPublicKey, overageFlag, allowOverage){
        let exists = await this.assetExists(ctx, simPublicKey);
        if (!exists) {
            throw new Error(`The asset ${simPublicKey} does not exist`);
        }
        let buffer = await ctx.stub.getState(simPublicKey);
        let asset = JSON.parse(buffer.toString());
        if(overageFlag === 'TRUE' && asset.allowOverage === ''){
            //we are in overage and therefore allowOverage value needs to be set
            asset.allowOverage = allowOverage;
            await ctx.stub.putState(simPublicKey, Buffer.from(JSON.stringify(asset)));
            //proceed to callOut
        }

        // define and set setOverageFlagEvent
        let setOverageFlagEvent = {
            type: 'Set Overage Flag',
            simPublicKey: simPublicKey
        };
        ctx.stub.setEvent('SetOverageFlagEvent-'+simPublicKey, Buffer.from(JSON.stringify(setOverageFlagEvent)));
    }

    //TODO: probably should also include the sim number that is being called - but leaving that for other devs
    async callOut(ctx, simPublicKey){
        let exists = await this.assetExists(ctx, simPublicKey);
        if (!exists) {
            throw new Error(`The asset ${simPublicKey} does not exist`);
        }
        let buffer = await ctx.stub.getState(simPublicKey);
        let asset = JSON.parse(buffer.toString());
        if(asset.overageFlag === 'TRUE' && asset.allowOverage === 'FALSE'){
            throw new Error(`No further calls will be allowed as the user ${simPublicKey} has reached the overage threshold and has denied the overage charges.`);
        }
        //if asset.overageFlag === 'FALSE' || (asset.overageFlag === 'TRUE' && asset.allowOverage === 'FALSE')
        //continue with callOut
        let callDetailIndex = asset.callDetails.length;
        asset.callDetails.push(new CallDetails(new Date(), '', ''));
        await ctx.stub.putState(simPublicKey, Buffer.from(JSON.stringify(asset)));

        // define and set callOutEvent
        let callOutEvent = {
            type: 'Call Out',
            simPublicKey: simPublicKey,
            startTime: new Date(asset.callDetails[callDetailIndex].callBegin).toLocaleString()
        };
        ctx.stub.setEvent('CallOutEvent-'+simPublicKey, Buffer.from(JSON.stringify(callOutEvent)));
    }

    //TODO: probably should also include the sim number that is being called - but leaving that for other devs
    async callEnd(ctx, simPublicKey){
        let exists = await this.assetExists(ctx, simPublicKey);
        if (!exists) {
            throw new Error(`The asset ${simPublicKey} does not exist`);
        }
        let buffer = await ctx.stub.getState(simPublicKey);
        let asset = JSON.parse(buffer.toString());
        if(asset.isValid === 'Fraud'){
            throw new Error(`This user ${simPublicKey} has been marked as fraudulent because the msisdn specified by this user is already in use. No calls can be made by this user.`);
        }
        let callDetailIndex;
        //get the call that is ongoing currently
        /*asset.callDetails.forEach(function(callDetail, i){
            if(callDetail.callBegin !== '' && callDetail.callEnd === ''){
                callDetailIndex = i;
            }
        });*/
        for (const[index, callDetail] of asset.callDetails.entries()){
            if(callDetail.callBegin !== '' && callDetail.callEnd === ''){
                callDetailIndex = index;
                break;
            }
        }
        if(callDetailIndex === undefined){
            throw new Error(`No ongoing call for the user ${simPublicKey} was found. Can not continue with callEnd process.`);
        }
        asset.callDetails[callDetailIndex].callEnd = new Date();
        let sim = await new SubscriberSim(simPublicKey, asset.msisdn, asset.address, asset.homeOperatorName, asset.roamingPartnerName,
            asset.isRoaming, asset.location, asset.latitude, asset.longitude, asset.roamingRate, asset.overageRate, asset.callDetails, asset.isValid, asset.overageThreshold, asset.allowOverage, asset.overageFlag);
        await ctx.stub.putState(simPublicKey, Buffer.from(JSON.stringify(sim)));
        let callDurationInSeconds = Math.ceil((new Date(asset.callDetails[callDetailIndex].callEnd).getTime() - new Date(asset.callDetails[callDetailIndex].callBegin).getTime())/1000);
        // define and set callEndEvent
        let callEndEvent = {
            type: 'Call End',
            simPublicKey: simPublicKey,
            startTime: new Date(asset.callDetails[callDetailIndex].callBegin).toLocaleString(),
            endTime: new Date(asset.callDetails[callDetailIndex].callEnd).toLocaleString(),
            callDuration: callDurationInSeconds + ' seconds',
            callDetailIndex: callDetailIndex
        };
        ctx.stub.setEvent('CallEndEvent-'+simPublicKey, Buffer.from(JSON.stringify(callEndEvent)));
    }

    //TODO: probably should also include the sim number that is being called - but leaving that for other devs
    async callPay(ctx, simPublicKey, callDetailIndex){
        let exists = await this.assetExists(ctx, simPublicKey);
        if (!exists) {
            throw new Error(`The asset ${simPublicKey} does not exist`);
        }
        let buffer = await ctx.stub.getState(simPublicKey);
        let asset = JSON.parse(buffer.toString());
        //if overage then overageRate, else roamingRate.
        let rate = asset.overageFlag === 'TRUE'?asset.overageRate:asset.roamingRate;

        let callDurationInSeconds = Math.ceil((new Date(asset.callDetails[callDetailIndex].callEnd).getTime() - new Date(asset.callDetails[callDetailIndex].callBegin).getTime())/1000);
        asset.callDetails[callDetailIndex].callCharges = (Math.ceil(callDurationInSeconds / 60) * rate).toFixed(2);
        let sim = await new SubscriberSim(simPublicKey, asset.msisdn, asset.address, asset.homeOperatorName, asset.roamingPartnerName,
            asset.isRoaming, asset.location, asset.latitude, asset.longitude, asset.roamingRate, asset.overageRate, asset.callDetails, asset.isValid, asset.overageThreshold, asset.allowOverage, asset.overageFlag);
        await ctx.stub.putState(simPublicKey, Buffer.from(JSON.stringify(sim)));
        // define and set callPayEvent
        let callDurationMinutesPortion = Math.floor(callDurationInSeconds/60);
        let callDurationSecondsPortion = callDurationInSeconds - callDurationMinutesPortion*60;
        let callPayEvent = {
            type: 'Call Pay',
            simPublicKey: simPublicKey,
            callDuration: (callDurationInSeconds) + ' seconds = ' + callDurationMinutesPortion + ':' + callDurationSecondsPortion + ' minutes',
            rateUsed: rate,
            callCharges: asset.callDetails[callDetailIndex].callCharges
        };
        ctx.stub.setEvent('CallPayEvent-'+simPublicKey, Buffer.from(JSON.stringify(callPayEvent)));
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

        queryResults.forEach(function(queryResult){
            simsForCSP.push(queryResult.Key);
        });
        console.info('List of sims related to this CSP: ', JSON.stringify(simsForCSP));
        return simsForCSP;
    }

}

module.exports = TelcoRoamingContract;
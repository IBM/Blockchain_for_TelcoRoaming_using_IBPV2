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
     * assetExists
     *
     * This function checks if a CSP/SubscriberSim exists.
     *
     * @param ctx - the context of the transaction
     * @param assetId - name in case of a CSP and publicKey in case of a SubscriberSim
     * @returns - true if the asset exists and false if the asset does not exist
     */
    async assetExists(ctx, assetId) {
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
        let exists = await this.assetExists(ctx, name);
        if (exists) {
            throw new Error(`The CSP ${name} already exists`);
        }

        let newCSP = new CSP(name, region, overageRate, roamingRate);
        await ctx.stub.putState(name, Buffer.from(JSON.stringify(newCSP)));

        // define and set createCSPEvent
        let createCSPEvent = {
            type: 'Create CSP',
            cspName: name
        };
        ctx.stub.setEvent('CreateCSPEvent-'+name, Buffer.from(JSON.stringify(createCSPEvent)));
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
        let sim = new SubscriberSim(publicKey, msisdn, address, homeOperatorName, roamingPartnerName, isRoaming, location, latitude, longitude, roamingRate, overageRate, callDetails, isValid, overageThreshold, allowOverage, overageFlag);
        await ctx.stub.putState(publicKey, Buffer.from(JSON.stringify(sim)));

        // define and set createSubscriberSimEvent
        let createSubscriberSimEvent = {
            type: 'Create SubscriberSim',
            simPublicKey: publicKey
        };
        ctx.stub.setEvent('CreateSubscriberSimEvent-'+publicKey, Buffer.from(JSON.stringify(createSubscriberSimEvent)));
    }

    /**
     *
     * updateCSP
     *
     * This function updates an existing CSP.
     *
     * @param ctx - the context of the transaction
     * @param name - the name of the CSP
     * @param region - the region for the CSP
     * @param overageRate - the overageRate charged by the CSP
     * @param roamingRate - the roamingRate charged by the CSP
     * @returns - nothing - but updates the world state with the CSP
     */
    async updateCSP(ctx, name, region, overageRate, roamingRate) {
        let exists = await this.assetExists(ctx, name);
        if (!exists) {
            throw new Error(`The CSP ${name} does not exist`);
        }

        let csp = new CSP(name, region, overageRate, roamingRate);
        await ctx.stub.putState(name, Buffer.from(JSON.stringify(csp)));
    }

    /**
     *
     * updateSubscriberSim
     *
     * This function updates an existing SubscriberSim.
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
    async updateSubscriberSim(ctx, publicKey, msisdn, address, homeOperatorName, roamingPartnerName,
        isRoaming, location, latitude, longitude, roamingRate, overageRate, callDetails, isValid, overageThreshold, allowOverage, overageFlag) {
        let exists = await this.assetExists(ctx, publicKey);
        if (!exists) {
            throw new Error(`The subscriber sim ${publicKey} does not exist`);
        }

        //verify that the homeOperator CSP is already created
        let HOexists = await this.assetExists(ctx, homeOperatorName);
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

        let sim = new SubscriberSim(publicKey, msisdn, address, homeOperatorName, roamingPartnerName, isRoaming, location, latitude, longitude, roamingRate, overageRate, callDetails, isValid, overageThreshold, allowOverage, overageFlag);
        await ctx.stub.putState(publicKey, Buffer.from(JSON.stringify(sim)));
    }

    /**
     *
     * deleteCSP
     *
     * This function deletes an existing CSP. It ensures that no subscriberSim is associated with this CSP
     * (i.e. no subscriberSim exists that has this CSP as either the homeOperator or the roamingPartner)
     * and only then the CSP is deleted.
     *
     * @param ctx - the context of the transaction
     * @param name - the name of the CSP
     * @returns - nothing - but removes the CSP from the world state
     */
    async deleteCSP(ctx, name) {
        let exists = await this.assetExists(ctx, name);
        let buffer, asset;
        if(exists){
            buffer = await ctx.stub.getState(name);
            asset = JSON.parse(buffer.toString());
        }
        if (!exists || asset.type !== 'CSP') {
            throw new Error(`The CSP ${name} does not exist`);
        }
        //if CSP exists, verify that no subscriber sims are associated with it (HomeOperator or RoamingPartner) before deleting the CSP
        let queryResults = await this.findAllSubscriberSimsForCSP(ctx, name);
        if (queryResults.length > 0){
            throw new Error(`The CSP ${name} can not be deleted as the following sims are currently in its network: ${queryResults}`);
        }
        await ctx.stub.deleteState(name);

        // define and set deleteCSPEvent
        let deleteCSPEvent = {
            type: 'Delete CSP',
            name: name
        };
        ctx.stub.setEvent('DeleteCSPEvent-'+name, Buffer.from(JSON.stringify(deleteCSPEvent)));
    }

    /**
     *
     * deleteSubscriberSim
     *
     * This function deletes an existing SubscriberSim.
     *
     * @param ctx - the context of the transaction
     * @param publicKey - the publicKey of the SubscriberSim
     * @returns - nothing - but removes the SubscriberSim from the world state
     */
    async deleteSubscriberSim(ctx, publicKey) {
        let exists = await this.assetExists(ctx, publicKey);
        let buffer, asset;
        if(exists){
            buffer = await ctx.stub.getState(publicKey);
            asset = JSON.parse(buffer.toString());
        }
        if (!exists || asset.type !== 'SubscriberSim') {
            throw new Error(`The subscriber sim ${publicKey} does not exist`);
        }
        await ctx.stub.deleteState(publicKey);

        // define and set deleteSimEvent
        let deleteSimEvent = {
            type: 'Delete Sim',
            simPublicKey: publicKey
        };
        ctx.stub.setEvent('DeleteSimEvent-'+publicKey, Buffer.from(JSON.stringify(deleteSimEvent)));
    }

    /**
     *
     * moveSim
     *
     * This function moves a SubscriberSim to a new location.
     *
     * @param ctx - the context of the transaction
     * @param simPublicKey - the publicKey of the SubscriberSim
     * @param newLocation - the location to which the SubscriberSim has moved
     * @returns - nothing - but updates the SubscriberSim in the world state.
     *
     * Generates an event that indicates that the sim has been moved.
     */

    //TODO: ideally the latitude and longitude will also get updated - that is being left for other developers to work on
    async moveSim(ctx, simPublicKey, newLocation){
        let exists = await this.assetExists(ctx, simPublicKey);
        if (!exists) {
            throw new Error(`The asset ${simPublicKey} does not exist`);
        }
        let buffer = await ctx.stub.getState(simPublicKey);
        let asset = JSON.parse(buffer.toString());
        asset.location = newLocation;
        await ctx.stub.putState(simPublicKey, Buffer.from(JSON.stringify(asset)));

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

    /**
     *
     * discovery
     *
     * This function discovers a sim that has moved to a new location and identifies the new localOperator
     * (roamingPartner - in case the location is not the same as the home location and
     * homeOperator - in case the location is the same as the home location)
     *
     * @param ctx - the context of the transaction
     * @param simPublicKey - the publicKey of the SubscriberSim
     * @returns - nothing
     *
     * Generates an event that indicates that the sim has been discovered and we now know of its new local operator.
     */
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
            console.log('List of operators in this area: ', JSON.stringify(operators));
            if(operators.length>0){
                returnValue = operators[0];
            }
            else{
                throw new Error(`No operators found for the location ${sim.location}`);
            }
        }
        else{
            //sim is back in home operator location. Return homeOperator's name
            returnValue = HO.name;
        }
        if(returnValue !== null){
            // define and set discoveryEvent
            let discoveryEvent = {
                type: 'Discover Sim',
                simPublicKey: simPublicKey,
                localOperator: returnValue
            };
            await ctx.stub.setEvent('DiscoveryEvent-'+simPublicKey, Buffer.from(JSON.stringify(discoveryEvent)));
        }
    }

    /**
     *
     * authentication
     *
     * This function authenticates a SubscriberSim that has been discovered in a new location.
     * The sim is marked as Active or Fraud by verifying that the msisdn of the sim is not already in use by another sim.
     *
     * @param ctx - the context of the transaction
     * @param simPublicKey - the publicKey of the SubscriberSim
     * @returns - nothing - but updates the SubscriberSim in the world state.
     *
     * Generates an event that indicates that the sim has been authenticated and specifies the validity (Active/Fraud) of the sim.
     */
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
        let isValid;
        if (queryResults.length > 0){
            isValid = 'Fraud';
        }
        else{
            isValid = 'Active';
        }
        if(currentSim.isValid !== isValid){
            currentSim.isValid = isValid;
            await ctx.stub.putState(simPublicKey, Buffer.from(JSON.stringify(currentSim)));
        }

        //create authenticationEvent
        let authenticationEvent = {
            type: 'Authenticate Sim',
            isValid: currentSim.isValid,
            simPublicKey: simPublicKey
        };
        await ctx.stub.setEvent('AuthenticationEvent-'+simPublicKey, Buffer.from(JSON.stringify(authenticationEvent)));
    }

    /**
     *
     * updateRate
     *
     * This function updates the roaming and overage rates of the SubscriberSim
     * once it has moved to a new location and has subsequently been discovered and authenticated.
     * Throws an error if the authentication step identified the sim's validity as Fraud.
     * Otherwise updates the rates.
     *
     * @param ctx - the context of the transaction
     * @param simPublicKey - the publicKey of the SubscriberSim
     * @param RPname - the name of the roaming partner CSP
     * @returns - nothing - but updates the SubscriberSim in the world state.
     *
     * Generates an event that indicates that the sim's rates have been updated.
     */
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
        //user has moved back to home location
        if (sim.homeOperatorName === RPname && sim.isRoaming === 'true'){
            sim.roamingPartnerName = '';
            sim.isRoaming = 'false';
            sim.roamingRate = '';
            sim.overageRate = '';
            await ctx.stub.putState(simPublicKey, Buffer.from(JSON.stringify(sim)));
        }
        else if (sim.homeOperatorName !== RPname){
            let exists = await this.assetExists(ctx, RPname);
            if (!exists) {
                throw new Error(`The asset ${RPname} does not exist`);
            }
            let buffer = await ctx.stub.getState(RPname);
            let RP = JSON.parse(buffer.toString());
            sim.roamingPartnerName = RP.name;
            sim.isRoaming = 'true';
            sim.roamingRate = RP.roamingRate;
            sim.overageRate = RP.overageRate;
            await ctx.stub.putState(simPublicKey, Buffer.from(JSON.stringify(sim)));
        }

        // define and set updateRate event
        let updateRateEvent = {
            type: 'UpdateRate Sim',
            simPublicKey: simPublicKey,
            homeOperator: sim.homeOperatorName,
            isRoaming: sim.isRoaming,
            roamingPartner: sim.roamingPartnerName,
            roamingRate: sim.roamingRate
        };
        await ctx.stub.setEvent('UpdateRateEvent-'+simPublicKey, Buffer.from(JSON.stringify(updateRateEvent)));
    }

    /**
     *
     * verifyUser
     *
     * This function verifies if a SubscriberSim can make a call.
     * It in turn calls checkIfFraudUser and checkForOverage functions.
     * Throws an error if checkIfFraudUser returns true, that is if the sim has isValid = Fraud.
     * Otherwise performs the call to checkForOverage which returns the overageFlags for the sim.
     *
     * @param ctx - the context of the transaction
     * @param simPublicKey - the publicKey of the SubscriberSim
     * @returns - nothing
     *
     * Generates an event that indicates that verifyUser was successful.
     * Adds the overageFlags (overageFlag, allowOverage) information for the sim as part of the event.
     */
    async verifyUser(ctx, simPublicKey){
        if(await this.checkIfFraudUser(ctx, simPublicKey)){
            throw new Error(`This user ${simPublicKey} has been marked as fraudulent because the msisdn specified by this user is already in use. No calls can be made by this user.`);
        }
        let overageFlags = await this.checkForOverage(ctx, simPublicKey);

        // define and set verifyUserEvent
        let verifyUserEvent = {
            type: 'Verify User',
            simPublicKey: simPublicKey,
            nearingOverage: overageFlags[0],
            allowOverage: overageFlags[1]
        };
        ctx.stub.setEvent('VerifyUserEvent-' + simPublicKey, Buffer.from(JSON.stringify(verifyUserEvent)));

    }

    /**
     *
     * checkIfFraudUser
     *
     * This function checks if the SubscriberSim has isValid = Fraud.
     *
     * @param ctx - the context of the transaction
     * @param simPublicKey - the publicKey of the SubscriberSim
     * @returns - true if sim.isValid = Fraud, else false
     */
    async checkIfFraudUser(ctx, simPublicKey){
        let exists = await this.assetExists(ctx, simPublicKey);
        if (!exists) {
            throw new Error(`The asset ${simPublicKey} does not exist`);
        }
        let buffer = await ctx.stub.getState(simPublicKey);
        let asset = JSON.parse(buffer.toString());
        if(asset.isValid === 'Fraud'){
            return true;
        }
        return false;
    }

    /**
     *
     * checkForOverage
     *
     * This function identifies if a SubscriberSim is reaching its overage limit, in which case it updates the overageFlag.
     *
     * @param ctx - the context of the transaction
     * @param simPublicKey - the publicKey of the SubscriberSim
     * @returns - the overageFlag and the allowOverage flag of the SubscriberSim.
     */
    async checkForOverage(ctx, simPublicKey){
        let exists = await this.assetExists(ctx, simPublicKey);
        if (!exists) {
            throw new Error(`The asset ${simPublicKey} does not exist`);
        }
        let buffer = await ctx.stub.getState(simPublicKey);
        let asset = JSON.parse(buffer.toString());
        if(asset.overageFlag === 'true'){
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
            asset.overageFlag = 'true';
            await ctx.stub.putState(simPublicKey, Buffer.from(JSON.stringify(asset)));
            return ['true', asset.allowOverage];
        }
        else{
            //not reaching overage threshold
            //return flags as is
            return [asset.overageFlag, asset.allowOverage];
        }
    }

    /**
     *
     * setOverageFlag
     *
     * This function updates the allowOverage flag of the SubscriberSim using allowOverage value that is passed as input.
     * The allowOverage flag indicates whether the blockchain user has agreed to the additional overage charges or not.
     *
     * @param ctx - the context of the transaction
     * @param simPublicKey - the publicKey of the SubscriberSim
     * @param allowOverage - the allowOverage flag value that has to be set in this sim
     * @returns - nothing - but updates the SubscriberSim in the world state.
     *
     * Generates an event that indicates that the setOverageFlag was successful.
     */
    async setOverageFlag(ctx, simPublicKey, allowOverage){
        let exists = await this.assetExists(ctx, simPublicKey);
        if (!exists) {
            throw new Error(`The asset ${simPublicKey} does not exist`);
        }
        let buffer = await ctx.stub.getState(simPublicKey);
        let asset = JSON.parse(buffer.toString());
        if(asset.overageFlag === 'true' && asset.allowOverage === ''){
            //we are in overage and therefore allowOverage value needs to be set
            asset.allowOverage = allowOverage;
            await ctx.stub.putState(simPublicKey, Buffer.from(JSON.stringify(asset)));
        }

        // define and set setOverageFlagEvent
        let setOverageFlagEvent = {
            type: 'Set Overage Flag',
            simPublicKey: simPublicKey
        };
        ctx.stub.setEvent('SetOverageFlagEvent-'+simPublicKey, Buffer.from(JSON.stringify(setOverageFlagEvent)));
    }

    /**
     *
     * callOut
     *
     * This function generates an outgoing call for the SubscriberSim.
     * If the sim hasn't reached overage limit or if it has reached overage limit but the user has accepted
     * the overage charges (during this call or at any callOut before this) then the call is made.
     * If the overage limit has been reached and the user has denied the overage charges (during this call
     * or at any callOut before this) then the call is not made, and an error is thrown.
     *
     * @param ctx - the context of the transaction
     * @param simPublicKey - the publicKey of the SubscriberSim
     * @returns - nothing - but updates the SubscriberSim in the world state.
     *
     * Generates an event that indicates that callOut was successful and specifies the begin time for the call.
     */

    //TODO: probably should also include the sim number that is being called - but leaving that for other devs to implement
    async callOut(ctx, simPublicKey){
        let exists = await this.assetExists(ctx, simPublicKey);
        if (!exists) {
            throw new Error(`The asset ${simPublicKey} does not exist`);
        }
        let buffer = await ctx.stub.getState(simPublicKey);
        let asset = JSON.parse(buffer.toString());
        if(asset.overageFlag === 'true' && asset.allowOverage === 'false'){
            throw new Error(`No further calls will be allowed as the user ${simPublicKey} has reached the overage threshold and has denied the overage charges.`);
        }
        //else if asset.overageFlag === 'false' || (asset.overageFlag === 'true' && asset.allowOverage === 'false')
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

    /**
     *
     * callEnd
     *
     * This function ends an ongoing call for the SubscriberSim.
     * It throws an error is no ongoing call is found for the sim, otherwise it finds the first ongoing call
     * for the sim and marks it as complete by adding a callEnd time.
     *
     * @param ctx - the context of the transaction
     * @param simPublicKey - the publicKey of the SubscriberSim
     * @returns - nothing - but updates the SubscriberSim in the world state.
     *
     * Generates an event that indicates that callEnd was successful and specifies the begin and end times for the call
     * as well as the duration of the call and the index of the call in the list of calls for this sim.
     */

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
        //get the call that is ongoing currently (that is the first call which has a non-null callBegin and a null callEnd)
        //assuming here that at a time only one call will be ongoing (which isn't necessarily true in a real scenario)
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
        await ctx.stub.putState(simPublicKey, Buffer.from(JSON.stringify(asset)));
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

    /**
     *
     * callPay
     *
     * This function calculates the charges for a particular call.
     * If the sim has crossed overageLimits then the rate used is the overageRate otherwise it is the roamingRate.
     * The callDuration is calculated and then multiplied by the rate to calculate the callCharges.
     *
     * @param ctx - the context of the transaction
     * @param simPublicKey - the publicKey of the SubscriberSim
     * @param callDetailIndex - the index number of the call in the list of calls for the sim
     * @returns - nothing - but updates the SubscriberSim in the world state.
     *
     * Generates an event that indicates that callPay was successful and
     * specifies the rate used for the call, the call duration and the call charges for this call.
     */

    //TODO: probably should also include the sim number that is being called - but leaving that for other devs
    async callPay(ctx, simPublicKey, callDetailIndex){
        let exists = await this.assetExists(ctx, simPublicKey);
        if (!exists) {
            throw new Error(`The asset ${simPublicKey} does not exist`);
        }
        let buffer = await ctx.stub.getState(simPublicKey);
        let asset = JSON.parse(buffer.toString());

        //if overage then overageRate, else roamingRate.
        let rate = asset.overageFlag === 'true'?asset.overageRate:asset.roamingRate;

        let callDurationInSeconds = Math.ceil((new Date(asset.callDetails[callDetailIndex].callEnd).getTime() - new Date(asset.callDetails[callDetailIndex].callBegin).getTime())/1000);
        asset.callDetails[callDetailIndex].callCharges = (Math.ceil(callDurationInSeconds / 60) * rate).toFixed(2);
        await ctx.stub.putState(simPublicKey, Buffer.from(JSON.stringify(asset)));

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

        let resultsIterator = await ctx.stub.getQueryResult(queryString);

        let allResults = [];

        // eslint-disable-next-line no-constant-condition
        while (true) {
            let res = await resultsIterator.next();

            if (res.value && res.value.value.toString()) {
                let jsonRes = {};

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
                await resultsIterator.close();
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

    async getHistoryForSim(ctx, simPublicKey) {
        let exists = await this.assetExists(ctx, simPublicKey);
        let buffer, asset;
        if(exists){
            buffer = await ctx.stub.getState(simPublicKey);
            asset = JSON.parse(buffer.toString());
        }
        if (!exists || asset.type !== 'SubscriberSim') {
            throw new Error(`The sim ${simPublicKey} does not exist`);
        }

        console.info('- start getHistoryForSim: %s\n', simPublicKey);

        let resultsIterator = await ctx.stub.getHistoryForKey(simPublicKey);
        let allResults = [];

        let index = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            let res = await resultsIterator.next();

            if (res.value && res.value.value.toString()) {
                let jsonRes = {};

                jsonRes.Key = index++;

                try {
                    jsonRes.Record = JSON.parse(res.value.value.toString('utf8'));
                } catch (err) {
                    console.log(err);
                    jsonRes.Record = res.value.value.toString('utf8');
                }

                allResults.push(jsonRes);
            }
            if (res.done) {
                await resultsIterator.close();
                return allResults;
            }
        }
    }
}

module.exports = TelcoRoamingContract;
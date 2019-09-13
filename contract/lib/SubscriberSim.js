'use strict';

class SubscriberSim {

    /**
     *
     * SubscriberSim
     *
     * Constructor for a SubscriberSim object. SubscriberSims are the assets of this application
     * - they will be registered with a home operator (a CSP)
     * - when roaming, the sims will be associated with a relevant roaming provider (a CSP)
     *
     * @param publicKey - the public identifier for this SubscriberSim
     * @param msisdn - the MSISDN associated with this SubscriberSim
     * @param address - the home address for this SubscriberSim
     * @param homeOperatorName - the name of the CSP that this SubscriberSim was originally registered with
     * @param roamingPartnerName - the name of the CSP that is associated with the SubscriberSim while it is roaming
     * @param isRoaming - flag that indicates if the SubscriberSim is currently roaming
     * @param location - current location of the SubscriberSim
     * @param latitude - current latitude of the SubscriberSim
     * @param longitude - current longitude of the SubscriberSim
     * @param ratetype - roaming rate as defined in the smart contract.
     * @param isValid - flag that indicates if the SubscriberSim is valid or fraudulent
     * @returns - SubscriberSim object
     */

    constructor(publicKey, msisdn, address, homeOperatorName, roamingPartnerName,
        isRoaming, location, latitude, longitude, roamingRate, overageRate, callDetails, isValid, overageThreshold, allowOverage, overageFlag) {

        this.publicKey = publicKey;
        this.msisdn = msisdn;
        this.address = address;
        this.homeOperatorName = homeOperatorName;
        this.roamingPartnerName = roamingPartnerName;
        this.isRoaming = isRoaming;
        this.location = location;
        this.latitude = latitude;
        this.longitude = longitude;
        this.roamingRate = roamingRate;
        this.overageRate = overageRate;
        if(callDetails === ''){
            this.callDetails = [];
        }
        else{
            this.callDetails = callDetails;
        }
        this.isValid = isValid;
        this.overageThreshold = overageThreshold;
        this.allowOverage = allowOverage;
        this.overageFlag = overageFlag;
        this.type = 'SubscriberSim';

        return this;
    }
}
module.exports = SubscriberSim;
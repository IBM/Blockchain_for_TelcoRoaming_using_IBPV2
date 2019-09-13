'use strict';

class CSP {

    /**
     *
     * CSP
     *
     * Constructor for a CSP object.
     *
     * @param name
     * @param region
     * @param overageRate - roaming rate as defined in the smart contract.
     * @param roamingRate - flag that indicates if the SubscriberSim is valid or fraudulent
     * @returns - CSP object
     */

    constructor(name, region, overageRate, roamingRate) {

        this.name = name;
        this.region = region;
        this.overageRate = overageRate;
        this.roamingRate = roamingRate;
        this.type = 'CSP';

        return this;
    }
}
module.exports = CSP;
'use strict';

class CallDetails {

    /**
     *
     * CallDetails
     *
     * Constructor for a CallDetails object. Part of the SubscriberSim object. It contains information
     * about the begin and end time of a call.
     *
     * @param callBegin - timestamp indicating when the call began.
     * @param callEnd - timestamp indicating when the call ended.
     * @returns - CallDetails object
     */

    constructor(callBegin, callEnd, callCharges) {

        this.callBegin = callBegin;
        this.callEnd = callEnd;
        this.callCharges = callCharges;

        return this;
    }
}
module.exports = CallDetails;
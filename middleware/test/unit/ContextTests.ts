/* tslint:disable: no-unused-expression */
import { expect } from 'chai';
import 'mocha';

import applySfFxMiddleware from '../../index';
import { ConnectionConfig, Constants, Context, Logger} from '@salesforce/salesforce-sdk';
import { generateData, generateRawMiddleWareRequest } from './FunctionTestUtils';


describe('Context Tests', () => {

    const validateContext = (data: any, context: Context, hasOnBehalfOfUserId: boolean = false) => {
        expect(context.org.apiVersion).to.exist;
        expect(context.org.apiVersion).to.equal(Constants.CURRENT_API_VERSION);

        expect(context.org.user).to.exist;
        expect(context.org.domainUrl).to.equal(data.context.userContext.orgDomainUrl);
        expect(context.org.id).to.equal(data.context.userContext.orgId);
        expect(context.org.baseUrl).to.equal(data.context.userContext.salesforceBaseUrl);
        expect(context.org.user.username).to.equal(data.context.userContext.username);
        expect(context.org.user.id).to.equal(data.context.userContext.userId);

        if (hasOnBehalfOfUserId) {
            expect(context.org.user.onBehalfOfUserId).to.equal(data.context.userContext.onBehalfOfUserId);
        } else {
            expect(context.org.user.onBehalfOfUserId).to.be.undefined;
        }
    };

    /**
     * validate the result of the applyMiddleWare, it should have 2 parameters in an array
     * the 1st is the user function payload
     * the 2nd is the sdk context
     *
     * @param expectedPayload
     * @param middlewareResult
     */
    const validateApplyMiddleWareResult = (data: any, middlewareResult : any) => {
        expect(middlewareResult).to.be.an('array');
        expect(middlewareResult).to.have.lengthOf(3);
        expect(middlewareResult[0]).to.exist;
        expect(middlewareResult[1]).to.exist;
        expect(middlewareResult[2]).to.exist;

        const event = middlewareResult[0];
        expect(event.id).to.not.be.undefined;
        expect(event.type).to.not.be.undefined;
        expect(event.source).to.not.be.undefined;
        expect(event.dataContentType).to.not.be.undefined;
        expect(event.dataSchema).to.not.be.undefined;
        expect(event.data).to.not.be.undefined;
        expect(event.headers).to.not.be.undefined;

        // validate user function payload
        const expectedPayload: any = event.data;
        expect(data.payload.html).to.equal(expectedPayload.html);
        expect(data.payload.isLightning).to.equal(expectedPayload.isLightning);
        expect(data.payload.url).to.equal(expectedPayload.url);

        // sfContext is removed
        expect(data.sfContext).to.not.exist;
    };

    const getContext = (data: any) : Context => {
        const rawRequest = generateRawMiddleWareRequest(data);
        const logger = new Logger('Evergreen Logger Context Unit Test');
        const mwResult: any = applySfFxMiddleware(rawRequest, {}, [logger]);
        validateApplyMiddleWareResult(data, mwResult);

        const context: Context = mwResult[1] as Context;
        return context;
    };

    it('validate context WITH accessToken', () => {
        const data = generateData(true, true);
        expect(data.context).to.exist;
        expect(data.context.apiVersion).to.exist;
        expect(data.sfContext.accessToken).to.exist;
        expect(data.sfContext.functionInvocationId).to.exist;
        const fxInvocationId: string = data.sfContext.functionInvocationId;
        const accessToken: string = data.sfContext.accessToken;

        const context: Context = getContext(data);
        validateContext(data, context, true);

        // Requires accessToken
        expect(context.org.data).to.exist;
        expect(context.org.unitOfWork).to.exist;
        expect(context['fxInvocation']).to.exist;
        expect(context['fxInvocation'].id).to.equal(fxInvocationId);

        // Validate ConnectionConfig has expected values
        // TODO: Prevent this, somehow.
        const connConfig: ConnectionConfig = context.org.data['connConfig'];
        expect(connConfig).to.exist;
        // TODO: Prevent access to accessToken
        expect(connConfig.accessToken).to.equal(accessToken);
        expect(connConfig.apiVersion).to.equal(data.context.apiVersion);
        expect(connConfig.instanceUrl).to.equal(data.context.userContext.salesforceBaseUrl);

        // Ensure accessToken was not serialized
        const dataApiJSON = JSON.stringify(context.org.data);
        expect(dataApiJSON).to.exist;
        expect(dataApiJSON).to.not.contain('accessToken');

        // Validate Connection has expected values
        // TODO: Prevent this, somehow.
        const conn = context.org.data['connect']();
        expect(conn).to.exist;
        // TODO: Prevent access to accessToken
        expect(conn.accessToken).to.equal(accessToken);
        expect(conn.version).to.equal(data.context.apiVersion);
        expect(conn.instanceUrl).to.equal(data.context.userContext.salesforceBaseUrl);
    });

    it('validate context WITHOUT accessToken', () => {
        const data = generateData(false);
        expect(data.context).to.exist;

        const context: Context = getContext(data);
        validateContext(data, context);

        // Requires accessToken
        expect(context.org.data).to.not.exist;
        expect(context.org.unitOfWork).to.not.exist;
        expect(context['fxInvocation']).to.not.exist;
    });

    it('validate API version override', () => {
        const data = generateData(true);
        expect(data.context).to.exist;
        expect(data.context.apiVersion).to.exist;
        data.context.apiVersion = '0.0'

        const context: Context = getContext(data);
        expect(context.org.apiVersion).to.exist;
        expect(context.org.apiVersion).to.equal('0.0');
    });

    it('should FAIL to create Context', () => {
        try {
            // Expecting missing data.context
            getContext({});
            expect.fail();
        } catch (err) {
            expect(err.message).to.contain('Context not provided in data');
        }
    });
});

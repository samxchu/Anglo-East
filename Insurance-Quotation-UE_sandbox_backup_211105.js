/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/config', 'N/log', 'N/record', 'N/redirect', 'N/runtime', 'N/search', 'N/ui/dialog', 'N/ui/message', 'N/ui/serverWidget', 'N/url'],
    function (config, log, record, redirect, runtime, search, dialog, message, serverWidget, url) {
        /**
         * const objRecord = scriptContext.newRecord, runtimeUser = runtime.getCurrentUser().role;
         * var workingMode = scriptContext.Type, totalErr = '', errNo = 1;
         */

        /**beforeLoad及其附屬*/
        function beforeLoad(scriptContext) {
            const runtimeUser = runtime.getCurrentUser().role;
            if (runtimeUser == 1009 || runtimeUser == 3) {
                quoAddButton(scriptContext);
            }
            return true;
        }

        function beforeSubmit (scriptContext) {
            try {
                log.debug(24);
                if (scriptContext.type == 'delete') {
                    var ueRecord = scriptContext.newRecord;
                    var ueID = ueRecord.id;
                    var userName = runtime.getCurrentUser().name;
                    log.debug(29);
                    var ueNumber = search.lookupFields({
                        type: 'estimate',
                        id: ueID,
                        columns: ['tranid']
                    })['tranid'];
                    log.debug(35);
                    var deleteLog = record.create({
                        type: 'customrecord_delete_log',
                        isDynamic: true
                    });
                    deleteLog.setValue('custrecord_transaction_type', 'Quotation');
                    deleteLog.setValue('custrecord_transaction_no', ueNumber);
                    deleteLog.setValue('custrecord_user', userName);
                    deleteLog.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });
                }
                return true;
            } catch (e) {
                log.debug('beforeSubmit', e.message);
                return false;
            }
        }

        function quoAddButton(scriptContext) {
            try {
                var oriRecord = scriptContext.newRecord;
                var id = oriRecord.id;
                if (scriptContext.type == 'create' || scriptContext.type == 'copy' || scriptContext.type == 'edit') {
                    scriptContext.form.addButton({
                        id: 'custpage_quo_insert_rs',
                        label: 'Insert Rating Sheet',
                        functionName: 'clickToInsertRS()'
                    });
                    scriptContext.form.addButton({
                        id: 'custpage_quo_cal',
                        label: '計算',
                        functionName: 'clickToQuoCal()'
                    });
                    scriptContext.form.addButton({
                        id: 'custpage_quo_insert_cd',
                        label: 'Customer Detail',
                        functionName: 'clickToQuoInsertCD()'
                    });
                } else {
                    scriptContext.form.addButton({
                        id: 'custpage_quo_renew',
                        label: 'Renew',
                        functionName: 'clickToRenewQuo(' + id + ')'
                    });
                    scriptContext.form.addButton({
                        id: 'custpage_quo_copy',
                        label: 'Copy',
                        functionName: 'clickToCopyQuo(' + id + ')'
                    });
                }
                scriptContext.form.clientScriptModulePath = 'SuiteScripts/Quotation/Insurance/Insurance-Quotation-CS.js';
                return true;
            } catch (e) {
                log.debug('quoAddButton', e.message);
                return false;
            }
        }

        /**beforeLoad及其附屬*/
        function afterSubmit(scriptContext) {
            const runtimeUser = runtime.getCurrentUser().role;
            if (runtimeUser == 1009 || runtimeUser == 3) {
                if (scriptContext.type == 'create' || scriptContext.type == 'copy') {
                    quoNumbering(scriptContext);
                }
            }
            return true;
        }

        function quoNumbering(scriptContext) {
            try {
                var oriRecord = scriptContext.newRecord;
                var oriRecordID = oriRecord.id;
                var action = oriRecord.getValue('custbody_iv_r_note');
                if (action.length > 5) {
                    var customrecord_iv_doc_num_exSearchObj = search.create({
                        type: "customrecord_iv_doc_num_ex",
                        filters:
                            [
                                ["name", "contains", action]
                            ],
                        columns:
                            [
                                search.createColumn({
                                    name: "name",
                                    sort: search.Sort.ASC,
                                    label: "Name"
                                }),
                                search.createColumn({name: "scriptid", label: "Script ID"}),
                                search.createColumn({name: "custrecord_iv_dne_type", label: "Numbering Type"}),
                                search.createColumn({name: "custrecord_iv_dne_seq", label: "Sequence"})
                            ]
                    });
                    customrecord_iv_doc_num_exSearchObj.run().each(function (result) {
                        var renewTimes = Number(result.getValue('custrecord_iv_dne_seq')) + 1;
                        record.submitFields({
                            type: 'customrecord_iv_doc_num_ex',
                            id: result.id,
                            values: {'custrecord_iv_dne_seq': renewTimes}
                        });
                        record.submitFields({
                            type: record.Type.ESTIMATE,
                            id: oriRecordID,
                            values: {
                                'tranid': action + '-' + ('0' + renewTimes).slice(-2) + '-' +
                                    oriRecord.getValue('startdate').getUTCFullYear(),
                                'custbody_iv_r_note': ''
                            }
                        });
                        return true;
                    });
                } else {
                    var orderTypeID = oriRecord.getValue('custbody_iv_order_type');
                    var typeCode = search.lookupFields({
                        type: 'customrecord_iv_order_type',
                        id: orderTypeID,
                        columns: ['custrecord_iv_short_code']
                    })['custrecord_iv_short_code'];
                    var yearCode = oriRecord.getValue('startdate').getUTCFullYear();
                    var quoNo = Number(search.lookupFields({
                        type: 'customrecord_iv_doc_num',
                        id: 5,
                        columns: ['custrecord_iv_dn_number']
                    })['custrecord_iv_dn_number']) + 1;
                    record.submitFields({
                        type: 'customrecord_iv_doc_num',
                        id: 5,
                        values: {'custrecord_iv_dn_number': quoNo}
                    });
                    record.submitFields({
                        type: 'estimate',
                        id: oriRecordID,
                        values: {
                            'tranid': 'Q' + typeCode + '-' + quoNo + '-00-' + yearCode,
                            'custbody_iv_r_note': '',
                            'custbody_renew_from': '',
                            'custbody_iv_doc_prev_tranid': ''
                        }
                    });
                    var docNewRecord = record.create({
                        type: 'customrecord_iv_doc_num_ex',
                        isDynamic: true
                    });
                    docNewRecord.setValue('customform', 36);
                    docNewRecord.setValue('name', 'Q' + typeCode + '-' + quoNo);
                    docNewRecord.setValue('custrecord_iv_dne_seq', 0);
                    docNewRecord.setValue('custrecord_iv_dne_type', 1);
                    docNewRecord.save();
                }
                return true;
            } catch (e) {
                log.debug('quoNumbering', e.message);
                return false;
            }
        }

        function quoTagNumbering(scriptContext) {
            try {
                return true;
            } catch (e) {
                log.debug('quoTagNumbering', e.message);
                return false;
            }
        }

        return {
            beforeSubmit: beforeSubmit,
            beforeLoad: beforeLoad,
            afterSubmit: afterSubmit
        };

    });

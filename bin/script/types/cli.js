"use strict";
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandType = void 0;
var CommandType;
(function (CommandType) {
    CommandType[CommandType["appAdd"] = 0] = "appAdd";
    CommandType[CommandType["appList"] = 1] = "appList";
    CommandType[CommandType["appDeploymentKeyList"] = 2] = "appDeploymentKeyList";
    CommandType[CommandType["appRemove"] = 3] = "appRemove";
    CommandType[CommandType["appRename"] = 4] = "appRename";
    CommandType[CommandType["debug"] = 5] = "debug";
    CommandType[CommandType["deploymentAdd"] = 6] = "deploymentAdd";
    CommandType[CommandType["deploymentHistory"] = 7] = "deploymentHistory";
    CommandType[CommandType["deploymentHistoryClear"] = 8] = "deploymentHistoryClear";
    CommandType[CommandType["deploymentList"] = 9] = "deploymentList";
    CommandType[CommandType["deploymentMetrics"] = 10] = "deploymentMetrics";
    CommandType[CommandType["deploymentRemove"] = 11] = "deploymentRemove";
    CommandType[CommandType["deploymentRename"] = 12] = "deploymentRename";
    CommandType[CommandType["login"] = 13] = "login";
    CommandType[CommandType["logout"] = 14] = "logout";
    CommandType[CommandType["patch"] = 15] = "patch";
    CommandType[CommandType["promote"] = 16] = "promote";
    CommandType[CommandType["release"] = 17] = "release";
    CommandType[CommandType["releaseReact"] = 18] = "releaseReact";
    CommandType[CommandType["rollback"] = 19] = "rollback";
})(CommandType || (exports.CommandType = CommandType = {}));

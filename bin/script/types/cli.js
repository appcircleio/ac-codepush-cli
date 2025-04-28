"use strict";
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandType = void 0;
var CommandType;
(function (CommandType) {
    CommandType[CommandType["accessKeyAdd"] = 0] = "accessKeyAdd";
    CommandType[CommandType["accessKeyPatch"] = 1] = "accessKeyPatch";
    CommandType[CommandType["accessKeyList"] = 2] = "accessKeyList";
    CommandType[CommandType["accessKeyRemove"] = 3] = "accessKeyRemove";
    CommandType[CommandType["appAdd"] = 4] = "appAdd";
    CommandType[CommandType["appList"] = 5] = "appList";
    CommandType[CommandType["appRemove"] = 6] = "appRemove";
    CommandType[CommandType["appRename"] = 7] = "appRename";
    CommandType[CommandType["debug"] = 8] = "debug";
    CommandType[CommandType["deploymentAdd"] = 9] = "deploymentAdd";
    CommandType[CommandType["deploymentHistory"] = 10] = "deploymentHistory";
    CommandType[CommandType["deploymentHistoryClear"] = 11] = "deploymentHistoryClear";
    CommandType[CommandType["deploymentList"] = 12] = "deploymentList";
    CommandType[CommandType["deploymentMetrics"] = 13] = "deploymentMetrics";
    CommandType[CommandType["deploymentRemove"] = 14] = "deploymentRemove";
    CommandType[CommandType["deploymentRename"] = 15] = "deploymentRename";
    CommandType[CommandType["link"] = 16] = "link";
    CommandType[CommandType["login"] = 17] = "login";
    CommandType[CommandType["logout"] = 18] = "logout";
    CommandType[CommandType["patch"] = 19] = "patch";
    CommandType[CommandType["promote"] = 20] = "promote";
    CommandType[CommandType["register"] = 21] = "register";
    CommandType[CommandType["release"] = 22] = "release";
    CommandType[CommandType["releaseReact"] = 23] = "releaseReact";
    CommandType[CommandType["rollback"] = 24] = "rollback";
    CommandType[CommandType["sessionList"] = 25] = "sessionList";
    CommandType[CommandType["sessionRemove"] = 26] = "sessionRemove";
})(CommandType || (exports.CommandType = CommandType = {}));

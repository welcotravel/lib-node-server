"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PathRule = void 0;
const path_parser_1 = require("path-parser");
class PathRule {
    constructor(sName, sPath) {
        this.name = sName;
        this.path = sPath;
        this.parser = new path_parser_1.Path(sPath);
    }
    test(sUrl) {
        this.matched = this.parser.test(sUrl);
        if (this.matched) {
            this.params = this.matched;
            return true;
        }
        return false;
    }
}
exports.PathRule = PathRule;
class PathParser {
    constructor(sPathname) {
        this.pathname = sPathname;
        this.matched = Object.values(PathParser.PATHS).find((oRule) => oRule.test(sPathname)) || PathParser.PATHS.NOT_FOUND;
    }
}
exports.default = PathParser;
PathParser.PATHS = {
    NOT_FOUND: new PathRule('Not Found', '/404')
};

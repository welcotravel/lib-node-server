import { Path, TestMatch } from 'path-parser';
interface Rules {
    [name: string]: PathRule<any>;
}
export declare class PathRule<T> {
    name: string;
    path: string;
    parser: Path;
    matched?: TestMatch;
    params?: T;
    constructor(sName: string, sPath: string);
    test(sUrl: string): boolean;
}
export default class PathParser {
    matched: PathRule<any>;
    pathname: string;
    static PATHS: Rules;
    constructor(sPathname: string);
}
export {};

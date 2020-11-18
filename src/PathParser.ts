import {Path, TestMatch} from 'path-parser'

interface Rules {
    [name: string]: PathRule<any>
}

export class PathRule<T> {
    public name:     string;
    public path:     string;
    public parser:   Path;
    public matched?: TestMatch;
    public params?:  T;

    constructor(sName: string, sPath: string) {
        this.name   = sName;
        this.path   = sPath;
        this.parser = new Path(sPath);
    }

    test(sUrl: string): boolean {
        this.matched = this.parser.test(sUrl);
        if (this.matched) {
            this.params = <T><unknown> this.matched;
            return true;
        }

        return false;
    }
}

export default class PathParser {
    public matched:  PathRule<any>;
    public pathname: string;

    public static PATHS: Rules = {
        NOT_FOUND: new PathRule('Not Found', '/404')
    };

    constructor(sPathname:string) {
        this.pathname = sPathname;
        this.matched  = (Object as any).values(PathParser.PATHS).find((oRule: PathRule<any>) => oRule.test(sPathname)) || PathParser.PATHS.NOT_FOUND;
    }
}
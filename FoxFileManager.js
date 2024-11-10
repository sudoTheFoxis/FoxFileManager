const fs = require('fs');

// internal modules
const FoxFileDB = require('./FoxFileDB.js')

class FoxFileManager {
    constructor (options) {
        /**
         * @description advanced nodejs file manager with support for isolated spaces in one instance
         * @param {Object}  options
         * @param {Object}  options.workspace       default dir where FFM's files will be stored
         * @param {Array}   options.metaValues      metadata values
         * @param {Boolean} options.skipinit        if true, init will be skipped for all databases
         * @param {Object}  options.DB
         * @param {String}  options.DB.rootdir      path belonging to a given database
         * @param {String}  options.DB.workspace    path where database files will be located (not the managed files)
         * @param {String}  options.DB.thumbdir     the path where the thumbnails unique to the database will be stored
         * @param {Array}   options.DB.metaValues      metadata values
         * @param {Boolean} options.DB.skipinit     if true, init will be skipped for given database
         * @param {Boolean} options.DB.force        when true, override existing database if exists
         */
        // console io functions
        this.info =  typeof(options?.IOFinfo) == "function"  ? options.IOFinfo : (msg) => { console.info( `[FFM]\x1b[32m[info]\x1b[0m:  ${msg}`) };
        this.warn =  typeof(options?.IOFwarn) == "function"  ? options.IOFwarn : (msg) => { console.warn( `[FFM]\x1b[33m[warn]\x1b[0m:  ${msg}`) };
        this.debug = typeof(options?.IOFdebug) == "function" ? options.IOFdebug : (msg) => { console.debug(`[FFM]\x1b[34m[debug]\x1b[0m: ${msg}`) };
        this.error = typeof(options?.IOFerror) == "function" ? options.IOFerror : (msg, fatal) => {
            console.error(`[FFM]\x1b[31m[error]\x1b[0m: ${msg}`); 
        };
        // initialize variables
        this.DB = new Map();
        this.workspace = options?.workspace ?? null;
        this.skipinit = options.skipinit == true ? true : false;
        // validate workspace
        if ( fs.existsSync(`${this.workspace}`) ) {
            if ( !(fs.lstatSync(`${this.workspace}`)).isDirectory() ) { 
                this.error(`@init workspace: ${this.workspace} exists and it is not a directory`);
                process.exit(1)
            }
        } else {
            this.debug(`@init creating: ${this.workspace}`);
            fs.mkdirSync(`${this.workspace}`, { recursive: true });
        }
        // initialize all databases
        Object.entries(options.DB).forEach(([key, value]) => {
            // validate
            if (key.includes(":")) return this.error(`database name cannot contain ':' character: ${key}`);
            if (key.trim().length < 1) return this.error(`database name is an empty string`);
            this.DB.set(key, new FoxFileDB({
                name: key,
                rootdir: value?.rootdir ?? this.rootdir,
                workspace: value?.workspace ?? this.workspace,
                thumbdir: value?.thumbdir ?? this.thumbdir,
                skipinit: value?.skipinit ?? this.skipinit,
                metaValues: value.metaValues ?? options.metaValues,
                force: value?.force ?? this.force,
            }))
        })
        // parse Inter DataBase Path
        this.parseIDBP = (dir) => {
            if(dir.startsWith("//")) {
                let name = dir.substring(2).split(":")[0]
                let db = this.DB.get(name)
                if (!db) return this.error(`@get() database "${name}" not found`)
                return { dir: dir.replace(`//${name}:`, ""), db }
            } else {
                return { dir }
            }
        }
    }

    add(...files) {
        /**
         * @description easiest way to add files
         * @param {String} file
         * if you adding files to the same database:    "dbname", [ { path: "..." }, { path: "..." }, ...  ]
         * if you adding files to diferent databases:   [ { path: "//dbname:/..." }, { path: "//dbname:/..." }, ... ]
         */
        if (typeof(files[0]) == "string") {
            let TargetDB = this.DB.get(files.shift());
            if (!TargetDB) return this.error("@add targeted db does not exists");
            return TargetDB.file.add(...files);
        } else {
            let resFile = (file) => {
                let res = this.parseIDBP(file.path);
                if(!res.db) return this.error(`database not provided: ${file.path}`);
                res.db.file.add(file);
            }
            files.forEach(file => {
                if ( Array.isArray(file) ) {
                    file.forEach(f => {
                        resFile(f);
                    })
                } else {
                    resFile(file);
                }
            })
        }
    }
    get(...paths) {
        /**
         * @description easiest way to get files
         * @param {String} dir  //{DB}:/path/to/file
         */
        
    }
    search(query) {
        /**
         * @description search all databases for files that math (not recomended when managing large amounts of files and/or databases)
         * @param {Object}  query
         * @param {String}  query.path          search for entry witch path, eg. "*dev.txt" will search for file dev.txt in any path,
         *                                      but it may also return files such as 123dev.txt, helldev.txt, ...
         * @param {String}  query.type          search for selected file types (video, image, audio, text, executable, unknown)
         * @param {String}  query.name          search for entry virtual name
         * @param {String}  query.description   search for words in description
         * @param {Array}   query.tags          all tags will be parsed individually, type them in array: ["tag1", "tag2", "tag3", ...]
         * @param {Object}  query.metadata      search for matadata, each key will be parsed individually: { key: "value", key2: "value" }
         * @param {Object}  query.color       
         * @param {Object}  query.color.<$>     values of color RGB: { R: 255, G: 255, B: 255 }, HSL: { H: 0, S: 0, L: 100 }
         * @param {Object}  query.color.D       tolerance level of other colors (0 - the same only, 254 - all colors just sort them)
         * @param {String}  query.sortBy        category by witch results will be sorted (path, name, type, created, modified, color (query.color must be provided))
         * @param {String}  query.mode          OR - all results that meet any of the stated requests,
         *                                      AND - all results that meet all of the requests given
         * @param {Number}  query.start         skip x number of results
         * @param {Number}  query.limit         number of results that will be returned (after skip)
        */
       
    }
    del(...paths) {
        /**
         * @description easiest way to delete files
         * @param {String} dir  //{DB}:/path/to/file
         */

    }
}
module.exports = FoxFileManager

dev()
async function dev() {
    console.log("\n\n");
    const FFM = new FoxFileManager({
        workspace: "../workspace",
        DB: {
            A: {
                workspace: "../workspace/A",
                //rootdir: "/run/media/foxis/Private/Zdięcia",
                rootdir: "$workspace/rootdir",
                thumbdir: "$workspace/thumbnails",
                //skipinit: true,
                force: true
            }
        }
    });
    
    let A_DB = FFM.DB.get("A");
    
    A_DB.destroy();
    A_DB.init();

    let res;

    res = await A_DB.files.add(
        { path: "/img/1.jpg" },
        { path: "/img/2.jpg" },
        { path: "/img/3.jpg" },
        { path: "/img/4.jpg" },
        { path: "/img/5.jpg" },
        { path: "/img/6.jpg" },
        { path: "/img/7.jpg" },
        "/vid/8.mp4",
        "/test.txt"
    );
    //console.log(res);

    res = await A_DB.thumbs.add(res.map(f => { return {target: f.path, id: f.id} }));
    //console.log(res);

    //res = A_DB.files.get(res)
    //console.log(res);

    res = A_DB.thumbs.get(res)
    console.log(res);
}





/*** * * * * * * * * * * * * * * * * * * * * *
 * @author sudoTheFoxis                      *
 * @github https://github.com/sudoTheFoxis   *
 * * * * * * * * * * * * * * * * * * * * * * */
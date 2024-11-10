const SQLite3 = require('better-sqlite3');
const fs = require('fs');

const TagsHandler = require('./Handlers/TagsHandler.js');
const FilesHandler = require('./Handlers/FilesHandler.js');
const ThumbsHandler = require('./Handlers/ThumbsHandler.js');
const EntriesHandler = require('./Handlers/EntriesHandler.js');

module.exports = class FoxFileDB {
    constructor(options) {
        /**
         * @description this module can work independently but with only indexing functionality
         * @param {Object}  options
         * @param {String}  options.name            name of this database
         * @param {String}  options.workspace       path where database file will be created
         * @param {String}  options.rootdir         directory with files that FoxFileDB will be indexing
         * @param {String}  options.thumbdir        directory where thumbnails will be stored
         * @param {Array}   options.metaValues      object of metadata values
         * @param {Boolean} options.skipinit        if true, database init will be skipped
         * @param {Boolean} options.force           override if database already exists
         * 
         * @param {Function}options.IOFinfo         \
         * @param {Function}options.IOFwarn          \
         * @param {Function}options.IOFdebug          > you can replace any of these functions with your own
         * @param {Function}options.IOFerror         /
         */
        this.name = options.name;
        // console io functions
        this.info =  typeof(options?.IOFinfo) == "function"  ? options.IOFinfo : (...msg) => { console.info( `[FFDB][${this.name}]\x1b[32m[info]\x1b[0m:`,...msg) };
        this.warn =  typeof(options?.IOFwarn) == "function"  ? options.IOFwarn : (...msg) => { console.warn( `[FFDB][${this.name}]\x1b[33m[warn]\x1b[0m:`,...msg) };
        this.debug = typeof(options?.IOFdebug) == "function" ? options.IOFdebug : (...msg) => { console.debug(`[FFDB][${this.name}]\x1b[34m[debug]\x1b[0m:`,...msg) };
        this.error = typeof(options?.IOFerror) == "function" ? options.IOFerror : (...msg) => {
            console.error(`[FFDB][${this.name}]\x1b[31m[error]\x1b[0m:`,...msg);
        };
        // path parser
        this.parsePath = (dir, danger) => {
            dir = danger != true ? dir.split("/").filter(d => d !== '..' && d !== '') : dir.split("/");
            if (dir[0].startsWith("$")) {
                switch (dir[0]) {
                    case "$rootdir":
                        dir[0] = this.rootdir;break;
                    case "$workspace":
                        dir[0] = this.workspace;
                        break;
                    case "$thumbdir":
                        dir[0] = this.thumbdir;break;
                    default:
                        dir.splice(0, 1);break;
                }
            }
            return dir
        }
        // initialize directories
        if (!options.workspace) { this.error("@init workspace not provided"); process.exit(1) }
        this.workspace = this.parsePath(options.workspace, true).join("/");
        
        if(!options.rootdir) { this.error("@init rootdir not provided"); process.exit(1) }
        this.rootdir = this.parsePath(options.rootdir, true).join("/");

        if(!options.thumbdir) { this.error("@init rootdir not provided"); process.exit(1) }
        this.thumbdir = this.parsePath(options.thumbdir, true).join("/");

        // initialize metadata handling
        this.MimeMap = new Map();
        this.MimeEntry = (mime) => {
            if(typeof(mime) != "string") return null;
            let res = this.MimeMap.get(mime) ?? this.MimeMap.get(mime.split('/')[0]);
            if (!res) res = this.MimeMap.get("default") ?? null;
            return res;
        }
        this.metaValues = options.metaValues ?? [
            {
                name: "Common",     // table name
                types: ["default"], // mime types that will be binded to this table (default - all that has not been binded)
                v: [                // values that this tabble will contain ( n - name, t - type, i - index the value )
                    { n: "metadata",   t: "object", i: false },
                    { n: "type",       t: "number", i: true },
                    { n: "keywords",   t: "string", i: false },
                    { n: "genre",      t: "string", i: false },
                    { n: "date",       t: "string", i: false },
                    { n: "author",     t: "string", i: false },
                    { n: "publisher",  t: "string", i: false },
                    { n: "copyright",  t: "string", i: false }
                ]
            },
            {
                name: "Video",
                types: ["video"],
                v: [
                    { n: "height",      t: "number", i: false },
                    { n: "width",       t: "number", i: false },
                    { n: "duration",    t: "number", i: false },
                    { n: "bitrate",     t: "number", i: false },
                    { n: "frame_rate",  t: "number", i: false },
                    { n: "location",    t: "string", i: false }
                ],
            },
            {
                name: "Image",
                types: ["image"],
                v: [
                    { n: "height",      t: "number", i: false },
                    { n: "width",       t: "number", i: false },
                    { n: "location",    t: "string", i: false }
                ],
            },
            {
                name: "Audio",
                types: ["audio"],
                v: [
                    { n: "bitrate",     t: "number", i: false },
                    { n: "sample_rate", t: "number", i: false },
                    { n: "duration",    t: "number", i: false }
                ],
            },
            {
                name: "Model",
                types: ["model"],
                v: [
                    { n: "vertices",    t: "number", i: false },
                    { n: "polygons",    t: "number", i: false }
                ],
            },
            {
                name: "Project",
                types: [],
                v: [
                    { n: "program",     t: "string", i: false },
                    { n: "project_dir", t: "string", i: false },
                    { n: "started",     t: "string", i: false },
                    { n: "status",      t: "string", i: false }
                ]
            }
        ];

        // init
        if(options?.skipinit != true) this.init(options.force);
    }
    init(force) {
        // validate directories
        try {
            // rootdir
            if ( fs.existsSync(`${this.rootdir}`) ) {
                if ( !(fs.lstatSync(`${this.rootdir}`)).isDirectory() ) { 
                    this.error(`@init rootdir: ${this.rootdir} exists and it is not a directory`); process.exit(1);
                }
            } else {
                this.debug(`@init creating: ${this.rootdir}`);
                fs.mkdirSync(`${this.rootdir}`, { recursive: true });
            }
            // workspace
            if ( fs.existsSync(`${this.workspace}`) ) {
                if ( !(fs.lstatSync(`${this.workspace}`)).isDirectory() ) { 
                    this.error(`@init workspace: ${this.workspace} exists and it is not a directory`); process.exit(1);
                }
            } else {
                this.debug(`@init creating: ${this.workspace}`);
                fs.mkdirSync(`${this.workspace}`, { recursive: true });
            }
            // DB file
            if ( fs.existsSync(`${this.workspace}/${this.name}.sqlite3`) ) {
                if (force == true) {
                    fs.rmSync(`${this.workspace}/${this.name}.sqlite3`);
                    this.debug(`force == true, overriding existing database: ${this.workspace}/${this.name}.sqlite3`);
                } else {
                    this.info(`using existing database: ${this.workspace}/${this.name}.sqlite3`)
                }
            }
        } catch (err) {
            this.error(`@init: \n ${err}`, true);
        }
        // parse matadata values
        let tables = "";
        this.MimeMap.clear();
        this.metaValues.forEach(table => {
            table.types?.forEach(t => {
                if (this.MimeMap.has(t)) {
                    this.warn("key already exists in MimeMap:", t)
                } else {
                    this.MimeMap.set(t, `Entries_Meta_${table.name}`);
                }
            });
            tables+=`CREATE TABLE IF NOT EXISTS Entries_Meta_${table.name} (\n    entry INTEGER NOT NULL PRIMARY KEY REFERENCES Entries(id) ON DELETE CASCADE,`;
            let indexes = "";
            table.v.forEach(v => {
                tables+=`\n    ${v.n} ${v.t == "number" ? "INTEGER" : "TEXT"},`;
                if (v.i == true) indexes+=`CREATE INDEX IF NOT EXISTS idx_Entries_Meta_${table.name}_${v.n} ON Entries_Meta_${table.name}(${v.n});\n`;
            })
            tables = tables.slice(0,-1)+"\n);\n"+indexes;
        });
        // initialize DataBase
        this.DB = new SQLite3(`${this.workspace}/${this.name}.sqlite3`).exec(`
            CREATE TABLE IF NOT EXISTS Thumbs (
                id          INTEGER     NOT NULL PRIMARY KEY REFERENCES Files(id) ON DELETE CASCADE,
                path        TEXT        NOT NULL,
                file        TEXT        NOT NULL,
                H           INTEGER     NOT NULL,
                S           INTEGER     NOT NULL,
                L           INTEGER     NOT NULL,
                UNIQUE(path, file)
            );
            CREATE INDEX IF NOT EXISTS idx_Thumbs_H ON Thumbs(H);
            CREATE INDEX IF NOT EXISTS idx_Thumbs_S ON Thumbs(S);
            CREATE INDEX IF NOT EXISTS idx_Thumbs_L ON Thumbs(L);

            CREATE TABLE IF NOT EXISTS Files (
                id          INTEGER     NOT NULL PRIMARY KEY AUTOINCREMENT,
                mime        TEXT        NOT NULL,
                path        TEXT        NOT NULL,
                file        TEXT        NOT NULL,
                hash        BLOB        NOT NULL,
                UNIQUE(path, file)
            );
            CREATE INDEX IF NOT EXISTS idx_Files_path ON Files(path);
            CREATE TABLE IF NOT EXISTS Files_Entries (
                file        INTEGER     NOT NULL REFERENCES Files(id) ON DELETE CASCADE,
                entry       INTEGER     NOT NULL REFERENCES Entries(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_Files_Entries_file ON Files_Entries(file);
            CREATE INDEX IF NOT EXISTS idx_Files_Entries_entry ON Files_Entries(entry);



            CREATE TABLE IF NOT EXISTS Entries (
                id          INTEGER     NOT NULL PRIMARY KEY AUTOINCREMENT,
                file_layout TEXT        ,
                name        TEXT        ,
                description TEXT        ,
                created     TIMESTAMP   NOT NULL,
                modified    TIMESTAMP   NOT NULL,
                hidden      INTEGER     
            );
                
            ${tables}



            CREATE TABLE IF NOT EXISTS Tags_Entries (
                entry       INTEGER     NOT NULL REFERENCES Entries(id) ON DELETE CASCADE,
                tag         INTEGER     NOT NULL REFERENCES Tags(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_Tags_Entries_entry ON Tags_Entries(entry);
            CREATE INDEX IF NOT EXISTS idx_Tags_Entries_tag ON Tags_Entries(tag);
            CREATE TABLE IF NOT EXISTS Tags (
                id          INTEGER     NOT NULL PRIMARY KEY AUTOINCREMENT,
                name        TEXT        NOT NULL,
                description TEXT        ,
                color       TEXT        
            );
            CREATE TABLE IF NOT EXISTS Tags_Tags (
                parent      INTEGER     NOT NULL REFERENCES Tags(id) ON DELETE CASCADE,
                child       INTEGER     NOT NULL REFERENCES Tags(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_Tags_Tags_parent ON Tags_Tags(parent);
            CREATE INDEX IF NOT EXISTS idx_Tags_Tags_child ON Tags_Tags(child);
        `)

        // initialize DataBase handlers
        this.tags       = new TagsHandler(this);
        this.files      = new FilesHandler(this);
        this.thumbs     = new ThumbsHandler(this);
        this.entries    = new EntriesHandler(this);
    }
    destroy() {
        fs.rmSync(`${this.workspace}/${this.name}.sqlite3`)
    }
}


/*
// Use DBML to define your database structure
// Docs: https://dbml.dbdiagram.io/docs
// https://dbdiagram.io

// thumbnail
Table Thumbs {
  note: "stores unique thumbnails for files"
  id          integer   [not null, pk]
  path        text      [not null, note: "thumbnail's parent folder"]
  file        text      [not null, note: "thumnail's file name"]
  Hue         integer   [not null]
  Saturation  integer   [not null]
  Lightness   integer   [not null]
}
// File
Table Files {
  note: "stores primary file data"
  id          integer   [not null, pk, increment]
  path        text      [not null, note: "path to parent folder of the file (/path/to)"]
  file        text      [not null, note: "file name (file)"]
  hash        blob      [not null, note: "checksum of targetet file"]
}
// Entries
Table Entries {
  note: "stores basic info about files"
  id          integer   [not null, pk, increment]
  file_layout text      [note:"in what order files will be grouped"]
  name        text      []
  description text      []
  created     timestamp [not null]
  modified    timestamp [not null]
  hidden      integer   [note: "null - not hiden, any number - hidden"]
}
Table Files_Entries {
  note: "stores tags of entry"
  entry       integer   [not null]
  file        integer   [not null]
}
Table Tags_Entries {
  note: "stores tags of entry"
  entry       integer   [not null]
  tag         integer   [not null]
}
// metadata
Table Entries_Meta_Common {
  entry       integer   [not null, pk]
  metadata    text      [note:"object of custom metadata"]
  type        text      [note:"file type"]
  keywords    text      []
  author      text      []
  publisher   text      []
  copyright   text      []
}
Table Entries_Meta_Video {
  entry       integer   [not null, pk]
  height      integer   [note:"pixels"]
  width       integer   [note:"pixels"]
  duration    integer   [note:"seconds"]
  bitrate     integer   [note:"bytes"]
  frame_rate  integer   [note:"fps"]
  relase      text      []
  genre       text      []
  location    text      []
}
Table Entries_Meta_Image {
  entry       integer   [not null, pk]
  height      integer   [note:"pixels"]
  width       integer   [note:"pixels"]
  color_depth integer   [note:"bytes"]
  location    text      []
}
Table Entries_Meta_Audio {
  entry       integer   [not null, pk]
  bitrate     integer   [note:"bytes"]
  sample_rate integer   [note:"Hz"]
  genre       text      []
}
Table Entries_Meta_Model {
  entry       integer   [not null, pk]
  vertices    integer   [note:"number of verticies"]
  polygons    integer   [note:"number of polygons"]
  genre       text      []
}
Table Entries_Meta_Project {
  entry       integer   [not null, pk]
  program     text      [note:"the name of program where the project is made in"]
  project_dir text      [note:"path to the folder where the project is located in"]
  started     text      [note:"when the project started"]
  status      text      [note:"when the projest has been finished"]
}
// Tags
Table Tags {
  note: "stores all existing tags"
  id          integer   [not null, pk, increment]
  name        text      [not null]
  description text      []
  color       text      []
}
Table Tags_Tags {
  note: "stores relationship betheen tags"
  parent      integer   [not null]
  child       integer   [not null]
  negate      integer   [not null, note:"null - child is related to parent, 1 - child is not related to parent"]
}
// references
ref: Thumbs.id - Files.id
ref: Files.id > Files_Entries.file
ref: Entries.id > Files_Entries.entry
ref: Tags_Entries.entry > Entries.id
ref: Entries_Meta_Common.entry - Entries.id
ref: Entries_Meta_Video.entry - Entries.id
ref: Entries_Meta_Images.entry - Entries.id
ref: Entries_Meta_Audio.entry - Entries.id
ref: Entries_Meta_Models.entry - Entries.id
ref: Entries_Meta_Projects.entry - Entries.id
ref: Tags.id < Tags_Entries.tag
ref: Tags_Tags.parent > Tags.id
ref: Tags_Tags.child > Tags.id

*/

/*
            CREATE TABLE IF NOT EXISTS Entries_Meta_Common (
                entry       INTEGER     NOT NULL PRIMARY KEY REFERENCES Entries(id) ON DELETE CASCADE,
                metadata    TEXT        ,
                type        TEXT        ,
                keywords    TEXT        ,
                genre       TEXT        ,
                author      TEXT        ,
                publisher   TEXT        ,
                copyright   TEXT        
            );
            CREATE INDEX IF NOT EXISTS idx_Entries_Meta_Common_type ON Entries_Meta_Common(type);
            CREATE TABLE IF NOT EXISTS Entries_Meta_Video (
                entry       INTEGER     NOT NULL PRIMARY KEY REFERENCES Entries(id) ON DELETE CASCADE,
                height      INTEGER     ,
                width       INTEGER     ,
                duration    INTEGER     ,
                bitrate     INTEGER     ,
                frame_rate  INTEGER     ,
                location    TEXT        
            );
            CREATE TABLE IF NOT EXISTS Entries_Meta_Image (
                entry       INTEGER     NOT NULL PRIMARY KEY REFERENCES Entries(id) ON DELETE CASCADE,
                height      INTEGER     ,
                width       INTEGER     ,
                location    TEXT        
            );
            CREATE TABLE IF NOT EXISTS Entries_Meta_Audio (
                entry       INTEGER     NOT NULL PRIMARY KEY REFERENCES Entries(id) ON DELETE CASCADE,
                bitrate     INTEGER     ,
                sample_rate INTEGER     ,
                duration    INTEGER     
            );
            CREATE TABLE IF NOT EXISTS Entries_Meta_Model (
                entry       INTEGER     NOT NULL PRIMARY KEY REFERENCES Entries(id) ON DELETE CASCADE,
                verticles   INTEGER     ,
                polygons    INTEGER     
            );
            CREATE TABLE IF NOT EXISTS Entries_Meta_Project (
                entry       INTEGER     NOT NULL PRIMARY KEY REFERENCES Entries(id) ON DELETE CASCADE,
                program     TEXT        ,
                project_dir TEXT        ,
                started     TEXT        ,
                status      TEXT        
            );
*/



/*** * * * * * * * * * * * * * * * * * * * * *
 * @author sudoTheFoxis                      *
 * @github https://github.com/sudoTheFoxis   *
 * * * * * * * * * * * * * * * * * * * * * * */
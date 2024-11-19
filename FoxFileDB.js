const SQLite3 = require('better-sqlite3');
const fs = require('fs');

const TagsHandler = require('./Handlers/TagsHandler.js');
const FilesHandler = require('./Handlers/FilesHandler.js');
const ThumbsHandler = require('./Handlers/ThumbsHandler.js');
const EntriesHandler = require('./Handlers/EntriesHandler.js');
const MetadataHandler = require('./Handlers/MetadataHandler.js');

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
        // DateTime parser
        this.parseDate = (date) => {
            let GMT = false;
            if (date) {
                date = date.trim();
                if (date.endsWith("GMT")) {
                    date=date.slice(0, -3).trim();GMT=true;
                }
                if (/^\d{1,2}:\d{2}:\d{2}$/.test(date)) { // provided only time
                    date = new Date(`${new Date().toISOString().split("T")[0]} ${date} ${GMT?'GMT':''}`);
                } else if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(date)) { // provided only date
                    date = new Date(`${date} ${new Date().toISOString().split("T")[1].replace(/\..+/, '')} GMT`);
                } else { // provided date and time
                    date = new Date(`${date} ${GMT?'GMT':''}`);
                }
            }
            if (!date || isNaN(date)) {
                date = new Date();
            }
            return date.toISOString().replace(/T/, ' ').replace(/\..+/, '') + " GMT";
        }
        // initialize directories
        if (!options.workspace) { this.error("@init workspace not provided"); process.exit(1) }
        this.workspace = this.parsePath(options.workspace, true).join("/");
        
        if(!options.rootdir) { this.error("@init rootdir not provided"); process.exit(1) }
        this.rootdir = this.parsePath(options.rootdir, true).join("/");

        if(!options.thumbdir) { this.error("@init rootdir not provided"); process.exit(1) }
        this.thumbdir = this.parsePath(options.thumbdir, true).join("/");

        // init
        if(options?.skipinit != true) this.init(options.force);
    }
    init(force) {
        this.debug("@init initializing database")
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
                    this.warn(`force == true, overriding existing database: ${this.workspace}/${this.name}.sqlite3`);
                } else {
                    this.info(`using existing database: ${this.workspace}/${this.name}.sqlite3`)
                }
            }
        } catch (err) {
            this.error(`@init: \n ${err}`, true);
        }
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
                entry       INTEGER     NOT NULL REFERENCES Entries(id) ON DELETE CASCADE,
                UNIQUE(file, entry)
            );
            CREATE INDEX IF NOT EXISTS idx_Files_Entries_file ON Files_Entries(file);
            CREATE INDEX IF NOT EXISTS idx_Files_Entries_entry ON Files_Entries(entry);



            CREATE TABLE IF NOT EXISTS Entries (
                id          INTEGER     NOT NULL PRIMARY KEY AUTOINCREMENT,
                filemap     TEXT        ,
                name        TEXT        ,
                description TEXT        ,
                created     TIMESTAMP   NOT NULL,
                modified    TIMESTAMP   NOT NULL,
                hidden      INTEGER     
            );



            CREATE TABLE IF NOT EXISTS Tags_Entries (
                entry       INTEGER     NOT NULL REFERENCES Entries(id) ON DELETE CASCADE,
                tag         INTEGER     NOT NULL REFERENCES Tags(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_Tags_Entries_entry ON Tags_Entries(entry);
            CREATE INDEX IF NOT EXISTS idx_Tags_Entries_tag ON Tags_Entries(tag);
            CREATE TABLE IF NOT EXISTS Tags (
                id          INTEGER     NOT NULL PRIMARY KEY AUTOINCREMENT,
                name        TEXT        UNIQUE NOT NULL,
                description TEXT        ,
                color       TEXT        
            );
            CREATE TABLE IF NOT EXISTS Tags_Tags (
                parent      INTEGER     NOT NULL REFERENCES Tags(id) ON DELETE CASCADE,
                child       INTEGER     NOT NULL REFERENCES Tags(id) ON DELETE CASCADE,
                negate      INTEGER     ,
                UNIQUE(parent, child)
            );
            CREATE INDEX IF NOT EXISTS idx_Tags_Tags_parent ON Tags_Tags(parent);
            CREATE INDEX IF NOT EXISTS idx_Tags_Tags_child ON Tags_Tags(child);
        `)

        // initialize DataBase handlers
        this.tags       = new TagsHandler(this);
        this.files      = new FilesHandler(this);
        this.thumbs     = new ThumbsHandler(this);
        this.entries    = new EntriesHandler(this);
        //this.meta       = new MetadataHandler(this); // i dont have the mental health to do it now
    }
    return() {
        let items = this.DB.prepare(`
            SELECT name, type, tbl_name 
            FROM sqlite_master 
            WHERE type IN ('table', 'index')
        `).all();

        let structure = {table: [], index: []};

        items.forEach((item) => {
            if (item.type === 'table') {
                structure.table.push({
                    name: item.name,
                    values: this.DB.prepare(`PRAGMA table_info(${item.name})`).all().map((column) => ({
                        name: column.name,
                        type: column.type,
                        opts: `${column.notnull ? "NOT NULL" : ""}${column.pk ? ", PRIMARY KEY" : ""}`.trim()
                    }))
                });
            } else if (item.type === 'index') {
                structure.index.push({
                    name: item.name,
                    values: this.DB.prepare(`PRAGMA index_info(${item.name})`).all().map((info) => ({
                        name: info.name,
                        seqno: info.seqno
                    })),
                    relatedTable: item.tbl_name
                });
            }
        });

        return structure;
    }
    destroy() {
        this.debug("@destroy deleting database")
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
  filemap     text      [note:"in what order files will be grouped"]
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
Table Meta_Main {
  id          integer   [not null, pk]
  metadata    text      [note:"invalid/custom keys are kept here as string/object"]
  group       integer   [note:"number of group (mainly for optimalization purpose)"]
  type        text      [note:"mime type"]
  keywords    text      []
  author      text      []
  publisher   text      []
  copyright   text      []
}
Table Meta_Video {
  id          integer   [not null, pk]
  height      integer   [note:"pixels"]
  width       integer   [note:"pixels"]
  duration    integer   [note:"seconds"]
  bitrate     integer   [note:"bytes"]
  frame_rate  integer   [note:"fps"]
  relase      text      []
  genre       text      []
  location    text      []
}
Table Meta_Image {
  id          integer   [not null, pk]
  height      integer   [note:"pixels"]
  width       integer   [note:"pixels"]
  color_depth integer   [note:"bytes"]
  location    text      []
}
Table Meta_Audio {
  id          integer   [not null, pk]
  bitrate     integer   [note:"bytes"]
  sample_rate integer   [note:"Hz"]
  genre       text      []
}
Table Meta_Model {
  id          integer   [not null, pk]
  vertices    integer   [note:"number of verticies"]
  polygons    integer   [note:"number of polygons"]
  genre       text      []
}
Table Meta_Project {
  id          integer   [not null, pk]
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
ref: Meta_Main.id - Files.id
ref: Meta_Video.id - Meta_Main.id
ref: Meta_Image.id - Meta_Main.id
ref: Meta_Audio.id - Meta_Main.id
ref: Meta_Model.id - Meta_Main.id
ref: Meta_Project.id - Meta_Main.id
ref: Tags.id < Tags_Entries.tag
ref: Tags_Tags.parent > Tags.id
ref: Tags_Tags.child > Tags.id

*/

/*
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
                v: {                // values that this tabble will contain ( n - name, t - type, i - index the value )
                    "metadata":     { t: "object", i: false },
                    "type":         { t: "number", i: true },
                    "keywords":     { t: "string", i: false },
                    "genre":        { t: "string", i: false },
                    "date":         { t: "string", i: false },
                    "author":       { t: "string", i: false },
                    "publisher":    { t: "string", i: false },
                    "copyright":    { t: "string", i: false }
                }
            },
            {
                name: "Video",
                types: ["video"],
                v: {
                    "height":       { t: "number", i: false },
                    "width":        { t: "number", i: false },
                    "duration":     { t: "number", i: false },
                    "bitrate":      { t: "number", i: false },
                    "frame_rate":   { t: "number", i: false },
                    "location":     { t: "string", i: false }
                },
            },
            {
                name: "Image",
                types: ["image"],
                v: {
                    "height":       { t: "number", i: false },
                    "width":        { t: "number", i: false },
                    "location":     { t: "string", i: false }
                },
            },
            {
                name: "Audio",
                types: ["audio"],
                v: {
                    "bitrate":      { t: "number", i: false },
                    "sample_rate":  { t: "number", i: false },
                    "duration":     { t: "number", i: false }
                },
            },
            {
                name: "Model",
                types: ["model"],
                v: {
                    "vertices":     { t: "number", i: false },
                    "polygons":     { t: "number", i: false }
                },
            },
            {
                name: "Project",
                types: [],
                v: {
                    "program":      { t: "string", i: false },
                    "project_dir":  { t: "string", i: false },
                    "started":      { t: "string", i: false },
                    "status":       { t: "string", i: false }
                }
            }
        ];
*/



/*** * * * * * * * * * * * * * * * * * * * * *
 * @author sudoTheFoxis                      *
 * @github https://github.com/sudoTheFoxis   *
 * * * * * * * * * * * * * * * * * * * * * * */
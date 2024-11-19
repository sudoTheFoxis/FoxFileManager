module.exports = class {
    #FF
    constructor(FF) {
        this.#FF = FF;

        /*
        this.Meta_Entries={ // groups of files (additional data)
            default: {
                'type':             'string', //     \
                'group':            'string', //      - hard coded keys
                'keywords':         'string', //     /
                'author':           'string',
                'publisher':        'string',
                'copyright':        'string'
            },
            comic: {
                'title':            'string',
            },
            serial: {
                'title':            'string',
            },
            movie: {
                'title':            'string',
            },
            project: {
                'program':          'string',
                'project_dir':      'string',
                'started':          'string',
                'status':           'string'
            }
        }
        */

        this.Meta_Files=[ // single files (technical data)
            // add on end: "*" - to make value required, "#" - to add index to value, "?" - to make value unique
            {
                name: 'Main', // this group is semi hard coded (for now)
                keys: {    
                    'mime':         'string*',
                    'group':        'string*#',
                    'keywords':     'string',
                    'custom':       'object'
                }
            },
            {
                name: 'Video',
                mime: ['video'],
                keys: {    
                    'height':       'number',
                    'width':        'number',
                    'duration':     'number',
                    'bitrate':      'number',
                    'frame_rate':   'number',
                    'location':     'string'
                }
            },
            {
                name: 'Image',
                mime: ['image'],
                keys: {
                    'height':       'number',
                    'width':        'number',
                    'location':     'string'
                }
            },
            {
                name: 'Audio',
                mime: ['audio'],
                keys: {
                    'bitrate':      'number',
                    'sample_rate':  'number',
                    'duration':     'number'
                }
            },
            {   
                name: 'Model',
                mime: ['model'],
                keys: {
                    'vertices':     'number',
                    'polygons':     'number'
                }
            }
        ];
        this.MimeMap = new Map();
        this.ValueMap = new Map();
        // destroy, if you want to delete all metadata entries
        this.destroy = () => {
            let items = this.#FF.DB.prepare(`
                SELECT name, type
                FROM sqlite_master 
                WHERE name LIKE '%Files_Meta_%'
            `).all();
            return items.map((item) => {
                if(item.type == 'table') {
                    this.#FF.DB.prepare(`DROP TABLE IF EXISTS ${item.name}`).run();
                    return item.name;
                } else if(item.type == 'index') {
                    this.#FF.DB.prepare(`DROP INDEX IF EXISTS ${item.name}`).run();
                    return item.name;
                } else {
                    return null;
                }
            });
        };
        // init, it's not very optimized, but it won't be used very often                       ( please send help... )
        this.init = (mode = 'skip') => {
            let isMainExists = false;
            this.Meta_Files.forEach((group) => {
                let TempSQL=`\nCREATE TABLE IF NOT EXISTS Files_Meta_${group.name} (\n`, TempIndex='', NotNull, Unique;
                if(group.name == 'Main') {
                    group.keys = { ...group.keys, 
                        mime:'string'+group.keys.mime, 
                        group:'string'+group.keys.group, 
                        keywords:'string'+group.keys.keywords,
                        custom:'object'+group.keys.custom
                    };
                    isMainExists=true;
                    TempSQL += '    id INTEGER NOT NULL PRIMARY KEY REFERENCES Files(id) ON DELETE CASCADE,\n';
                } else {
                    TempSQL += '    id INTEGER NOT NULL PRIMARY KEY REFERENCES Files_Meta_Main(id) ON DELETE CASCADE,\n';
                }
                Object.keys(group.keys).map(k => {
                    TempSQL+=`    '${k}'`;
                    if(group.keys[k].includes('#')) TempIndex+=`\nCREATE INDEX IF NOT EXISTS idx_Files_Meta_${group.name}_${k} ON Files_Meta_${group.name}('${k}');`;
                    NotNull=group.keys[k].includes('*')?' NOT NULL':'';
                    Unique=group.keys[k].includes('?')?' UNIQUE':'';
                    switch(true) {
                        case group.keys[k].startsWith('number'):
                            group.keys[k]='number';   TempSQL+=` INTEGER${NotNull+Unique},\n`; break;
                        case group.keys[k].startsWith('string'):
                            group.keys[k]='string';   TempSQL+=` TEXT${NotNull+Unique},\n`;    break;
                        case group.keys[k].startsWith('object'):
                            group.keys[k]='object';   TempSQL+=` TEXT${NotNull+Unique},\n`;    break;
                        case group.keys[k].startsWith('boolean'):
                            group.keys[k]='boolean';  TempSQL+=` TEXT${NotNull+Unique},\n`;    break;
                        default:
                            group.keys[k]='undefined';TempSQL+=` NULL,\n`;              break;
                    }
                });
                TempSQL = TempSQL.slice(0,-2)+"\n);"+TempIndex;
                
                let ExTabble = this.#FF.DB.prepare(`PRAGMA table_info(Files_Meta_${group.name});`).all();
                if (ExTabble.length > 0) {
                    let NeTableCols = Object.keys(group.keys);
                    let ExTableCols = ExTabble.map(k=>k.name);
                    let ColToAdd = NeTableCols.filter(x => !ExTableCols.includes(x));
                    let ColToRem = ExTableCols.filter(x => !NeTableCols.includes(x) && x != 'id');

                    if (ColToAdd.length < 1 && ColToRem.length < 1) {
                        //this.#FF.debug(`#meta@init same table with name 'Files_Meta_${group.name}' already exists, skipping`);

                    } else {
                        //if (mode == 'merge') {
                        if (mode == 'override') {
                            this.#FF.DB.exec(`
                                DROP TABLE Files_Meta_${group.name};
                                ${TempSQL}
                            `);
                            this.#FF.warn(`#meta@init different table with name 'Files_Meta_${group.name}' already exists, overriding`);

                        } else { // skip
                            this.#FF.warn(`#meta@init different table with name 'Files_Meta_${group.name}' already exists, mode = 'skip', skipping`);
                        }
                    }
                } else {
                    this.#FF.DB.exec(TempSQL);
                }

                group.mime?.forEach((m) => { this.MimeMap.set(m, group.name) });
                this.ValueMap.set(group.name, group.keys);
            })
            if(!isMainExists) {
                this.#FF.error("#meta@init primary group 'Main' has not been defined");
            }
        };
        this.init();
    }
    async add(...metas) {
        /**
         * @description 
         * @param {Object}  meta
         * @param {Number}  meta.id         id of entry that this metadata is refering to
         * @param {String}  meta.mime       full mime type of file (<category>/<type>)
         * @param {Array}   meta.keywords   array of keywords, like tags but less efficient
         * @param {Object}  meta.custom     custom json object data (may be used to find file but it is not recomended)
         * 
         * @param {String}  meta.group      name of targeted group (null - none)
         * @param {Object}  meta.keys
         * @param {unknown} meta.keys.<key> keys from targeted group
         * @param {unknown} meta.<key>      other keys defined in "default" group
         * 
         * @param {Boolean} meta.raw        if true, data will not be checked
         */
        let ProcessMeta = (meta) => {
            if (typeof(meta) != "object") return {meta:meta,code:400};
            if (meta?.raw == true) return meta;

            
            







            return meta;
        }
        metas = await Promise.all(metas.flat().map(ProcessMeta));

        return metas;
    }
    get(...ids) {
        /**
         * @description 
         */

    }
    del(...ids) {
        /**
         * @description 
         */
        
    }
}

/*
            if(!meta.id) return {...meta,code:422};
            let res = this.#FF.DB.prepare(`
                SELECT * FROM Files
                WHERE id = ?
                LIMIT 1
            `).get(meta.id);
            if(!res) return {...meta,code:404};
            
            if(!meta.mime) { // get mime type by extension (to do)
                meta.mime = res.mime;
            }
            
            if(meta.keywords) {
                if(Array.isArray(meta.keywords)) meta.keywords = meta.keywords.map(k => `"${k}"`).join(',');
                else meta.keywords = `"${meta.keywords}"`;
            }
            
            if(meta.custom) meta.custom = JSON.stringify(meta.custom);
            
            if(meta.group) {
                let res = this.Meta_Files.filter(group => meta.group.toLowerCase() == group.name.toLowerCase() && meta.group.toLowerCase() != "MAIN")
                if(!res || res.length != 1) meta.group = undefined;
                meta.group = res[0].name;
            }
            if(!meta.group) { // assign entry to group by mime type
                let res = this.MimeMap.get(meta.mime);
                if(!res) res = this.MimeMap.get(meta.mime.split("/")[0]) || this.MimeMap.get("default");
                if(res) meta.group = res;
            }

            if(meta.keys && meta.group) {
                let GroupValues = this.ValueMap.get(meta.group)
                let keys = meta.keys;
                meta.keys = [''];
                Object.keys(keys).map(key => {
                    if(!GroupValues[key] || typeof(keys[key]) != GroupValues[key]) return;
                    meta.keys[0]+=` ${key},`; meta.keys.push(keys[key]);
                })
                meta.keys[0] = meta.keys[0].slice(0,-1)+" ";
            }

            // other keys
*/


/*** * * * * * * * * * * * * * * * * * * * * *
 * @author sudoTheFoxis                      *
 * @github https://github.com/sudoTheFoxis   *
 * * * * * * * * * * * * * * * * * * * * * * */
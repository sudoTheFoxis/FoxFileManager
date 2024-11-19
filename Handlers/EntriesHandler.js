module.exports = class {
    #FF
    constructor(FF) {
        this.#FF = FF
    }
    async add(...entries) {
        /**
         * @description add entry to database
         * @param {Object}  entry
         * @param {string}  entry.name      name
         * @param {string}  entry.desc      description
         * @param {string}  entry.created   date created  \
         * @param {string}  entry.modified  date modified  in format: YYYY.MM.DD HH:MM:SS GMT
         * @param {Boolean} entry.hidden    is entry hidden
         * @param {Array}   entry.filemap   id of existing files that will be linked to this entry
         * @param {Array}   entry.tags      list of existing tag ids that will be linked to this entry
         * 
         * @param {Object}  entry.meta      metadata keys that will be linked to this entry   ( redirects to FFDB.meta.add() )
         * 
         * @param {Boolean} file.raw        if true, data will not be checked
         */
        let ProcessEntries = (entry) => {
            if (typeof(entry) != "object") entry={filemap:entry};
            if (entry?.raw == true) return entry;

            entry.created = entry.created ? this.#FF.parseDate(entry.created) : new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '') + " GMT";
            entry.modified = entry.modified ? this.#FF.parseDate(entry.modified) : entry.created;
            entry.hidden = entry.hidden == true ? true : false;

            if (!entry.filemap) entry.filemap = entry.files;
            entry.files = [];

            if (!entry.filemap || entry.filemap?.length < 1 || Object.keys(entry.filemap).length < 1 ) return {...entry,code:422};
            let parseItem = (item) => {
                if (Array.isArray(item)) {
                    return item.reduce((key, value, index) => {
                        key[index + 1] = parseItem(value);
                        return key;
                    }, {});
                } else if (typeof item === 'object' && item !== null) {
                    return Object.keys(item).reduce((key, value) => {
                        key[value] = parseItem(item[value]);
                        return key;
                    }, {});
                }
                let id = this.#FF.DB.prepare(`
                    SELECT * FROM Files
                    WHERE id = ?
                `).get(item)?.id;
                if(id) entry.files.push(id);
                return id;
            }
            entry.filemap = parseItem(entry.filemap);

            return entry;
        }
        entries = await Promise.all(entries.flat().map(ProcessEntries));

        let InsertEntries = this.#FF.DB.transaction((entries) => {
            let insertEntry = this.#FF.DB.prepare(`
                INSERT OR IGNORE INTO Entries (filemap, name, description, created, modified, hidden)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            let linkFile = this.#FF.DB.prepare(`
                INSERT OR IGNORE INTO Files_Entries (file, entry)
                VALUES (?, ?)
            `)
            return entries.map((entry)=>{
                if(entry.code)return {id:undefined,...entry}; // entry is invalid 4XX
                if(entry.files.length<1)return {id:undefined,...entry,code:404};
                let{changes:chk,lastInsertRowid:id}=insertEntry.run( // insert into database
                    JSON.stringify(entry.filemap), entry.name, entry.desc, 
                    entry.created, entry.modified, entry.hidden == true ? entry.modified : null
                );
                if(chk<1)return {id:undefined,...entry,code:409}; // conflict 409 (is this even possible?)
                entry.files.forEach(file => {
                    linkFile.run(file, id)
                });
                return {id,...entry,code:201};
            });
        });
        return InsertEntries(entries);
    }
    get(...ids) {
        /**
         * @description simple function to get entries
         * @param {Number}  id
         */
        ids = ids.flat();
        return this.#FF.DB.prepare(`
            SELECT * FROM Entries
            ${ids.length > 0 ? 'WHERE ' + ids.map(id => 'id = ?').join(" OR ") : ''}
        `).all(ids.map(id => typeof(id) == "object" ? id.id : id))
    }
    del(...ids) {
        /**
         * @description simple function to delete entry from database
         * @param {Number}  id
         */
        return;
    }
}




/*** * * * * * * * * * * * * * * * * * * * * *
 * @author sudoTheFoxis                      *
 * @github https://github.com/sudoTheFoxis   *
 * * * * * * * * * * * * * * * * * * * * * * */
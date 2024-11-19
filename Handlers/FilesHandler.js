const crypto = require('crypto');
const fs = require('fs');
const FileType = require('file-type');

module.exports = class {
    #FF
    constructor(FF) {
        this.#FF = FF
    }
    async add(...files) {
        /**
         * @description simple function to add file to registry
         * @param {Object}  file
         * @param {String}  file.path   path to file
         * @param {String}  file.mime   mime type
         * @param {hash}    file.hash   file checksum/hash
         * @param {Boolean} file.raw    if true, data will not be checked
         */
        // process given items
        let ProcessFiles = async (file) => {
            if (typeof(file) != "object") file={path:file};
            if (file?.raw == true) return file;
            /*// parse Path
            if (file.path.startsWith("//")) {
                let name = file.path.substring(2).split(":")[0];
                if(!name.includes("/")) {
                    if(this.#FF.name != name) return {...file,code:421};    // wrong database 421
                    file.path = file.path.replace(`//${name}:`, "");
                }
            }//*/
            let slicedPath = this.#FF.parsePath(file.path);
            file.file = slicedPath.pop(); file.path = "/"+slicedPath.join("/");
            let realpath = `${this.#FF.rootdir}${file.path}/${file.file}`;
            try {
                // check if file is valid
                let stats = await fs.promises.stat(realpath);
                if (stats.isDirectory()) return {...file,code:422};         // file is not valid 433
                // generate checksum and get mime type if not provided
                if (!file.hash || !file.mime) {
                    let filelink = await fs.promises.open(realpath, 'r');
                    if (stats.size <= 25 * 1024 * 1024) { // 25 MB
                        let fileBuffer = await fs.promises.readFile(filelink);
                        file.hash = file.hash || crypto.createHash("md5").update(fileBuffer).digest("hex");
                        file.mime = file.mime || (await FileType.fromBuffer(fileBuffer))?.mime || "text/plain";
                    } else {
                        if(!file.mime) {
                            let { buffer } = await filelink.read({ length: 4100, position: 0 });
                            file.mime = (await FileType.fromBuffer(buffer))?.mime || "text/plain";
                        }
                        if(!file.hash) {
                            let readStream = filelink.createReadStream();
                            let hash = crypto.createHash("md5");
                            readStream.on('data', (chunk) => hash.update(chunk));
                            file.hash = await new Promise((resolve, reject) => {
                                readStream.on('end', () => resolve(hash.digest("hex")));
                                readStream.on('error', reject);
                            });
                        }
                    }; filelink.close();
                }
            } catch (error) {return {...file,code:404};} // file not exists or is inaccessible 404
            return file;
        };
        files = await Promise.all(files.flat().map(ProcessFiles));

        // insert into Files database
        let InsertFiles = this.#FF.DB.transaction((files) => {
            let insertFile = this.#FF.DB.prepare(`
                INSERT OR IGNORE INTO Files (file, path, mime, hash)
                SELECT ?, ?, ?, ?
                WHERE NOT EXISTS (SELECT 1 FROM Files WHERE file = ? AND path = ?)
            `);
            return files.map((file)=>{
                if(file.code)return{id:undefined,path:(file.path=="/"?"":file.path)+(file.file?"/"+file.file:""),code:file.code}; // file is invalid 4XX
                let{changes:chk,lastInsertRowid:id}=insertFile.run( // insert into database
                    file.file,file.path,file.mime,file.hash,
                    file.file,file.path
                );
                if(chk<1)return{id:undefined,path:(file.path=="/"?"":file.path)+"/"+file.file,code:409}; // file exists 409
                return{id,path:(file.path=="/"?"":file.path)+"/"+file.file,mime:file.mime,code:201}; // sucess 201
            });
        });
        return InsertFiles(files);
    }
    get(...ids) {
        /**
         * @description simple function to get file by its id
         * @param {Number}  id
         */
        ids = ids.flat();
        return this.#FF.DB.prepare(`
            SELECT * FROM Files
            ${ids.length > 0 ? 'WHERE ' + ids.map(id => 'id = ?').join(" OR ") : ''}
        `).all(ids.map(id => typeof(id) == "object" ? id.id : id))
    }
    del(...ids) {
        /**
         * @description simple function to delete file from registry
         * @param {Number}  id
         */
        ids = ids.flat();
        return this.#FF.DB.prepare(`
            DELETE FROM Files
            WHERE ${ids.map(id => 'id = ?').join(" OR ")}
        `).run(ids.map(id => typeof(id) == "object" ? id.id : id))
    }
}

        /*let taskQueue = [];
        let parseFile = (file) => {
            taskQueue.push(
                this.#FF.DB.transaction(async (file) => {
                    // validate Path
                    if (file.path.startsWith("//")) {
                        let name = file.path.substring(2).split(":")[0];
                        if(!name.includes("/")) {
                            if(this.#FF.name != name) {this.#FF.error(`#file@add() ${file.path} is not adressed to this database!`);return;}
                            file.path = file.path.replace(`//${name}:`, "");
                        }
                    }
                    let slicedPath = this.#FF.parsePath(file.path)
                    file.file = slicedPath.pop();
                    file.path = "/"+slicedPath.join("/");
    
                    // check if file exists
                    if (file?.force != true) {
                        let realpath = `${this.#FF.rootdir}${file.path}/${file.file}`;
                        if (!fs.promises.existsSync(realpath) && file.path?.length > 4) { this.#FF.error(`#Files@add(): '${realpath}' does not exists`);return;}
                        if ((fs.promises.lstatSync(realpath)).isDirectory()) { this.#FF.error(`#Files@add(): '${realpath}' is a directory`);return;}
    
                        // generate checksum of file
                        let fileBuffer = fs.promises.readFileSync(realpath);
                        file.hash = file.hash ?? crypto.createHash("md5").update(fileBuffer).digest("hex");
                        file.mime = file.mime ?? FileType.fromBuffer(fileBuffer)?.mime;
                    }
    
                    // insert into Files table
                    let id = this.#FF.DB.prepare(`
                        INSERT INTO Files
                        (file, path, mime_type, hash)
                        VALUES (?, ?, ?, ?)
                    `).run(
                        file.file,
                        file.path,
                        file.mime ?? "text/plain",
                        file.hash ?? "0"
                    ).lastInsertRowid;
                    return id;
                })   
            )
        }
        // manage all entries
        files.forEach(file => {
            if (file.path) {
                parseFile(file);
            } else if ( Array.isArray(file) ) {
                file.forEach(f => {parseFile(f);})
            } else {
                parseFile({path:file});
            }
        });
        return taskQueue;*/




/*** * * * * * * * * * * * * * * * * * * * * *
 * @author sudoTheFoxis                      *
 * @github https://github.com/sudoTheFoxis   *
 * * * * * * * * * * * * * * * * * * * * * * */
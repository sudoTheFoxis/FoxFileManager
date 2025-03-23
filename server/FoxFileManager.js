const fs = require('fs');
const express = require('express');
const multer = require('multer');

class FoxFileManager {
    constructor (options) {
        this.workspace = options.workspace;
        this.rootdir = options.rootdir || `${this.workspace}/rootdir`;
        this.prefix = options.prefix || "/api"

        // console io functions
        this.info =  (msg) => {console.info( `[${new Date().toTimeString().slice(0, 8)}]\x1b[32m[info]\x1b[90m[${new Error().stack.split('\n')[2].match(/at (\S+)/)[1]}]\x1b[0m:`, msg);};
        this.debug = (msg) => {console.debug(`[${new Date().toTimeString().slice(0, 8)}]\x1b[36m[debug]\x1b[90m[${new Error().stack.split('\n')[2].match(/at (\S+)/)[1]}]\x1b[0m:`, msg);};
        this.warn =  (msg) => {console.warn( `[${new Date().toTimeString().slice(0, 8)}]\x1b[33m[warn]\x1b[90m[${new Error().stack.split('\n')[2].match(/at (\S+)/)[1]}]\x1b[0m:`, msg);};
        this.error = (msg) => {console.error(`[${new Date().toTimeString().slice(0, 8)}]\x1b[31m[error]\x1b[90m[${new Error().stack.split('\n')[2].match(/at (\S+)/)[1]}]\x1b[0m:`, msg);};

        // init workspace

        // express integration
        this.Router = express.Router();
        this.multer = multer({
            storage: multer.diskStorage({
                destination: `${this.workspace}/temp/uploads`,
                filename: (req, file, cb) => {
                    let customName = req.body.filename || file.originalname;
                    cb(null, `${Date.now()}-${customName}`);
                }
            }),
            limits: { fileSize: 1 * 1024 * 1024 * 1024 }, // 1GB limit
        });

        // load modules
        if(!fs.existsSync(`${__dirname}/Modules`)) return console.log("./Modules not found");
        fs.readdirSync(`${__dirname}/Modules`).forEach(dir => {
            let module = require(`${__dirname}/Modules/${dir}`);
            if(typeof(module) != "function") return this.error(`./Modules/${dir}, is not a function`);
            module(this);
        })
    }
    tree(path, options) {
        /**
         * @description return json data of provided directory/file
         * @param {String}  path                diretory that will be maped
         * @param {Object}  options
         * @param {Number}  options.depth       how deep map/tree should go?
         * @param {Boolean} options.detailed    return detailed info about listed files/folders
         */
        let data = {
            code: 200,
            path: this.parsePath(path),
            type: "unknown"
        };
        let realPath = `${this.rootdir}/${data.path.join('/')}`;
        let lstat = fs.lstatSync(realPath, { throwIfNoEntry: false });
        if (!lstat) return {...data, code: 404};

        switch (lstat.mode & 0o170000) {
            case 0o040000: data.type = "directory";         break;
            case 0o100000: data.type = "file";              break;
            case 0o120000: data.type = "symlink";           break;
            case 0o020000: data.type = "character device";  break;
            case 0o060000: data.type = "block device";      break;
            case 0o010000: data.type = "fifo (named pipe)"; break;
            case 0o140000: data.type = "socket";            break;
        }

        if (options?.detailed) {
            data.permissions = (lstat.mode & 0o777).toString(8);
            data.created = lstat.birthtime.toISOString().replace(/T/, ' ').replace(/\..+/, '') + " GMT";
            data.modified = lstat.mtime.toISOString().replace(/T/, ' ').replace(/\..+/, '') + " GMT";
            if (data.type == "file") data.size = lstat.size;
        }

        if (data.type == "directory" && options?.depth > 0) {
            data.content = {};
            fs.readdirSync(realPath).forEach(node => {
                data.content[node] = this.tree(`${path}/${node}`, { ...options, depth: options?.depth-1 });
            })
        }

        return data;
    }
    parsePath(path, options) {
        /**
         * @description path parser
         */
        return path
            .split("/")
            .filter((item) => !['', '~', '.', '..'].includes(item));
    }
}
module.exports = FoxFileManager

/*** * * * * * * * * * * * * * * * * * * * * *
 * @author sudoTheFoxis                      *
 * @github https://github.com/sudoTheFoxis   *
 * * * * * * * * * * * * * * * * * * * * * * */
const ffmpeg = require("fluent-ffmpeg");
const sharp = require("sharp");
const fs = require('fs');

module.exports = class {
    #FF
    constructor(FF) {
        this.#FF = FF

        try {
            // common
            if ( fs.existsSync(`${this.#FF.thumbdir}/common`) ) {
                if ( !(fs.lstatSync(`${this.#FF.thumbdir}/common`)).isDirectory() ) { 
                    this.#FF.error(`Thumbs@init $thumbdir/common: ${this.#FF.thumbdir} exists and it is not a directory`); process.exit(1);
                }
            } else {
                this.#FF.debug(`Thumbs@init creating: ${this.#FF.thumbdir}/common`);
                fs.mkdirSync(`${this.#FF.thumbdir}/common`, { recursive: true });
            }
            // custom
            if ( fs.existsSync(`${this.#FF.thumbdir}/custom`) ) {
                if ( !(fs.lstatSync(`${this.#FF.thumbdir}/custom`)).isDirectory() ) { 
                    this.#FF.error(`Thumbs@init $thumbdir/custom: ${this.#FF.thumbdir} exists and it is not a directory`); process.exit(1);
                }
            } else {
                this.#FF.debug(`Thumbs@init creating: ${this.#FF.thumbdir}/custom`);
                fs.mkdirSync(`${this.#FF.thumbdir}/custom`, { recursive: true });
            }
            // temp
            if ( fs.existsSync(`${this.#FF.thumbdir}/temp`) ) {
                if ( !(fs.lstatSync(`${this.#FF.thumbdir}/temp`)).isDirectory() ) { 
                    this.#FF.error(`Thumbs@init $thumbdir/temp: ${this.#FF.thumbdir} exists and it is not a directory`); process.exit(1);
                }
            } else {
                this.#FF.debug(`Thumbs@init creating: ${this.#FF.thumbdir}/temp`);
                fs.mkdirSync(`${this.#FF.thumbdir}/temp`, { recursive: true });
            }
        } catch (err) {
            console.log(err)
        }


        // thumbnail generator
        this.ThumbGen = async ({ source, mime, name, video }) => {
            let output = `${this.#FF.thumbdir}/temp/${name}.jpg`
            switch (true) {
                case mime.startsWith("video"):
                    let targetTime = await new Promise((resolve, reject) => {
                        ffmpeg.ffprobe(source, (err, metadata) => {
                            if(err){reject();}
                            else{resolve(metadata.format.duration*(video/100));}
                        });
                    });
                    if (!targetTime) targetTime = 1;
                    let tempFilePath = `${this.#FF.thumbdir}/temp/${name}-temp.jpg`;
                    await new Promise((resolve, reject) => {
                        ffmpeg(source)
                            .seekInput(targetTime)
                            .outputOptions(["-frames:v 1"])
                            .save(tempFilePath)
                            .on("end", resolve)
                            .on("error", reject);
                    });
                    await sharp(tempFilePath)
                        .resize({ width: 256, height: 256, fit: 'inside' })
                        .toFile(output);
                    fs.unlinkSync(tempFilePath);
                    return output;

                case mime.startsWith("image"):
                    await sharp(source)
                        .resize({ width: 256, height: 256, fit: 'inside' })
                        .toFile(output);
                    return output;

                case mime.startsWith("audio"):
                    this.#FF.debug("#thumbs@ThumbGen generating thumbnals for audio files is not supported yet")
                    return null;
                    
                default:
                    return null;
            }
        };


    }
    async add(...thumbs) {
        /**
         * @description create/add thumbnail for file
         * @param {Object}  thumb
         * @param {Number}  thumb.id        id of file
         * @param {String}  thumb.hex       manually provide dominant color
         * @param {Number}  thumb.H         Hue
         * @param {Number}  thumb.S         Saturation
         * @param {Number}  thumb.L         Lightness
         * @param {String}  thumb.target    path to the file from which the thumbnail will be generated
         * @param {String}  thumb.mime      type of media (image or video, any other will be skipped)
         * @param {String}  thumb.src       custom thumbnail path (baybe in future)
         * @param {Boolean} thumb.raw       if true, data will not be checked
         */
        // process thumbnail data
        let ProcessThumb = async (thumb) => {
            if(typeof(thumb)!="object") thumb={id:thumb};
            if(!thumb.id) return {...thumb,code:422};
            if(thumb.raw==true) return thumb;

            // check if target file exists
            let res = this.#FF.DB.prepare(`
                SELECT * FROM Files
                WHERE id = ?
                LIMIT 1
            `).get(thumb.id);
            if(!res) return {...thumb,code:404};
            if(!thumb.mime) thumb.mime=res.mime; // if mime not provided
            if(!thumb.target) thumb.target=(res.path=="/"?"":res.path)+"/"+res.file; // if target not provided

            // maybe custom thumnail folder support in future (but for what?)
            thumb.path = "$thumbdir";
            thumb.file = thumb.id+".jpg";
            
            // validate thumbnail
            thumb.src = await this.ThumbGen({source:`${this.#FF.rootdir}${thumb.target}`,mime:thumb.mime,name:thumb.id,video:1});
            if(!thumb.src) return {...thumb,code:415};

            // get dominant colors
            let R,G,B
            if(thumb.hex) {
                // HEX to RGB
                thumb.hex = thumb.hex.replace(/^#/, "");
                if (thumb.hex.length == 3) {
                    thumb.hex = thumb.hex[0] + thumb.hex[0] + thumb.hex[1] + thumb.hex[1] + thumb.hex[2] + thumb.hex[2];
                }
                if(/^[0-9A-F]{6}$/i.test(thumb.hex)) {
                    R = parseInt(thumb.hex.slice(0,2),16) / 255;
                    G = parseInt(thumb.hex.slice(2,4),16) / 255;
                    B = parseInt(thumb.hex.slice(4,6),16) / 255;
                }
            }
            if(!R || !G || !B) {
                let {data} = await sharp(thumb.src)
                    .resize(1, 1).raw().toBuffer({ resolveWithObject: true });
                R = data[0] / 255;
                G = data[1] / 255;
                B = data[2] / 255;
            }
            // RGB to HSL
            let Max=Math.max(R,G,B),Min=Math.min(R,G,B),H,S,L=(Max+Min)/2;
            if (Max === Min) { 
                H = S = 0; 
            } else {
                let delta = Max - Min;
                S = L > 0.5 ? delta / (2 - Max - Min) : delta / (Max + Min);
                switch (Max) {
                    case R: H = (G - B) / delta + (G < B ? 6 : 0); break;
                    case G: H = (B - R) / delta + 2; break;
                    case B: H = (R - G) / delta + 4; break;
                }; H /= 6;
            }
            thumb.H=Math.round(H*360);thumb.S=Math.round(S*100);thumb.L=Math.round(L*100);

            return thumb;
        }
        thumbs = await Promise.all(thumbs.flat().map(ProcessThumb));

        // insert into Files database
        let InsertThumbs = this.#FF.DB.transaction((thumbs) => {
            let InsertThumb = this.#FF.DB.prepare(`
                INSERT OR IGNORE INTO Thumbs (id, path, file, H, S, L)
                VALUES (?, ?, ?, ?, ?, ?)
            `);

            return thumbs.map((thumb)=>{
                if(thumb?.code) return {id:thumb.id,code:thumb.code}; // file is invalid 4XX
                let{changes:chk,lastInsertRowid:id} = InsertThumb.run(
                    thumb.id,thumb.path,thumb.file,thumb.H,thumb.S,thumb.L
                )
                if(chk<1) {
                    fs.unlinkSync(thumb.src);return{id:thumb.id,code:409}; // file exists 409
                } else {
                    fs.renameSync(thumb.src,this.#FF.parsePath(`${thumb.path}/custom/${thumb.file}`).join("/"))
                }
                return {id,code:201};
            });
        });
        return InsertThumbs(thumbs);
    }
    get(...ids) {
        /**
         * @description simple function to get thumbnail by its id
         * @param {Number}  id
         */
        ids = ids.flat();
        let res = this.#FF.DB.prepare(`
            SELECT * FROM Thumbs
            ${ids.length > 0 ? 'WHERE ' + ids.map(id => 'id = ?').join(" OR ") : ''}
        `).all(ids.map(id => typeof(id) == "object" ? id.id : id))
        return res;
    }
    del(...ids) {
        /**
         * @description simple function to delete thumbnail by its id
         * @param {Number}  id
         */
        ids = ids.flat();
        return this.#FF.DB.prepare(`
            DELETE FROM Thumbs
            WHERE ${ids.map(id => 'id = ?').join(" OR ")}
        `).run(ids.map(id => typeof(id) == "object" ? id.id : id))
    }
}




/*** * * * * * * * * * * * * * * * * * * * * *
 * @author sudoTheFoxis                      *
 * @github https://github.com/sudoTheFoxis   *
 * * * * * * * * * * * * * * * * * * * * * * */
module.exports = class {
    #FF
    constructor(FF) {
        this.#FF = FF
        this.metaValues = {
            Common: {
                metadata:   "object",
                type:       "number",
                keywords:   "string",
                genre:      "string",
                date:       "string",
                author:     "string",
                publisher:  "string",
                copyright:  "string"
            },
            Video: {
                height:     "number",
                width:      "number",
                duration:   "number",
                bitrate:    "number",
                frame_rate: "number",
                location:   "string"
            },
            Image: {
                height:     "number",
                width:      "number",
                location:   "string"
            },
            Audio: {
                bitrate:    "number",
                sample_rate:"number",
                duration:   "number"
            },
            Model: {
                vertices:   "number",
                polygons:   "number"
            },
            Project: {
                program:    "string",
                project_dir:"string",
                started:    "string",
                status:     "string"
            }
        }
    }
    add() {
        /**
         * @description 
         * @param {Object}  meta
         * @param {Number}  meta.entry      id of entry that this metadata is refering to
         */
    }
    get() {
        /**
         * @description 
         */

    }
    del() {
        /**
         * @description 
         */
        
    }
}
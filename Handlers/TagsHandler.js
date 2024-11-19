module.exports = class {
    #FF
    constructor(FF) {
        this.#FF = FF
    }
    async add(...tags) {
        /**
         * @description add tags to database registry
         * @param {Object}  tag
         * @param {String}  tag.name            name of the tag
         * @param {String}  tag.desc            description
         * @param {String}  tag.color           color
         * @param {Array}   tag.tags
         * @param {Object}  tag.tags[x]
         * @param {Number}  tag.tags[x].id      id/name of targeted tag
         * @param {Boolean} tag.tags[x].neg     negate relationship
         */
        let ProcessTags = (tag) => {
            if (typeof(tag) != "object") tag={name:tag};
            if (tag?.raw == true) return tag;

            if (tag.color) {
                tag.color = tag.color.replace(/^#/, "");
                if (tag.color.length == 3) {
                    tag.color = tag.color[0] + tag.color[0] + tag.color[1] + tag.color[1] + tag.color[2] + tag.color[2];
                }
                if(!/^[0-9A-F]{6}$/i.test(tag.color)) tag.color = null;
            }

            if (tag.tags) {
                if(!Array.isArray(tag.tags)) return {...tag,code:400}
            }

            return tag;
        }
        tags = await Promise.all(tags.flat().map(ProcessTags));

        let InsertTags = this.#FF.DB.transaction((tags) => {
            let insertTag = this.#FF.DB.prepare(`
                INSERT OR IGNORE INTO Tags (name, description, color)
                SELECT ?, ?, ?
                WHERE NOT EXISTS (SELECT 1 FROM Tags WHERE name = ?)
            `);
            let linkTag = this.#FF.DB.prepare(`
                INSERT OR IGNORE INTO Tags_Tags (parent, child, negate)
                VALUES (?, ?, ?)
            `)
            let findId = this.#FF.DB.prepare(`
                SELECT * FROM Tags
                WHERE id = ?
            `);
            let findName = this.#FF.DB.prepare(`
                SELECT * FROM Tags
                WHERE name = ?
            `);
            return tags.map((tag)=>{
                if(tag.code)return {id:undefined,...tag};
                let{changes:chk,lastInsertRowid:id}=insertTag.run(
                    tag.name, tag.desc, tag.color, tag.name
                )
                if(chk<1)return {id:undefined,...tag,code:409};
                
                if(tag.tags)
                tag.tags = tag.tags.map(t => {
                    if(typeof(t) != "object") t={id:t};
                    t.neg = t.neg == true ? 1 : null;

                    if(typeof(t.id) == "number") {
                        t.id = findId.get(t.id)?.id;
                    } else {
                        t.id = findName.get(t.id)?.id;
                    }
                    return {...t, succes: linkTag.run(id, t.id, t.neg)?.changes == 1 ? true : false};
                });
                
                return {id,...tag,code:201}
            });
        });
        return InsertTags(tags);
    }
    get(...ids) {
        /**
         * @description simple function to get tags
         * @param {Number}  id
         */
        ids = ids.flat();
        return this.#FF.DB.prepare(`
            SELECT * FROM Tags
            ${ids.length > 0 ? 'WHERE ' + ids.map(id => 'id = ?').join(" OR ") : ''}
        `).all(ids.map(id => typeof(id) == "object" ? id.id : id))
    }
    del(...ids) {
        /**
         * @description simple function to delete tag from database
         * @param {Number}  id
         */
        
    }
}



/*** * * * * * * * * * * * * * * * * * * * * *
 * @author sudoTheFoxis                      *
 * @github https://github.com/sudoTheFoxis   *
 * * * * * * * * * * * * * * * * * * * * * * */
module.exports = (FFM) => {
    FFM.Router.get("/view", (req, res, next) => {
        /**
         * @description <host:port>/<prefix>/view?path=<path> to return json object containing path content
         */
        if(!req.query.path) return res.status(400).json({});
        let options = {};
        if (typeof(+req.query.depth) == 'number') options.depth = (+req.query.depth);
        if (req.query.detailed != undefined) options.detailed = true;
        res.json(FFM.tree(req.query.path, options));
    })
}
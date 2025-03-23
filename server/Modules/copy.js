const fs = require('fs');

module.exports = (FFM) => {
    FFM.Router.get("/copy", (req, res, next) => {
        /**
         * @description <host:port>/<prefix>/copy?file=<file>&path=<path>
         * copy file to path
        */
        // check if file exists
        if(!req.query.path) return res.status(400).json({});
        let file = FFM.parsePath(req.query.file)
        let realFile = `${FFM.rootdir}/${file.join('/')}`;
        if(!fs.existsSync(realFile)) return res.status(404).json({});
        
        // check if path exists
        if(!req.query.file) return res.status(400).json({});
        let path = FFM.parsePath(req.query.path)
        let realPath = `${FFM.rootdir}/${path.join('/')}`;
        if(!req.query.override) {
            if(fs.existsSync(realPath)) return res.status(409).json({});
        } 

        // move
        fs.copyFileSync(realFile, realPath)
        res.json({
            message: "copied file",
            from: file,
            to: path
        })
    });
}
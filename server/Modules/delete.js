const fs = require('fs');

module.exports = (FFM) => {
    FFM.Router.get("/delete", (req, res, next) => {
        /**
         * @description <host:port>/<prefix>/delete?path=<path>
         */
        // check if file exists
        if(!req.query.path) return res.status(400).json({});
        let path = FFM.parsePath(req.query.path)
        let realPath = `${FFM.rootdir}/${path.join('/')}`;
        let lstat = fs.lstatSync(realPath, { throwIfNoEntry: false })
        if(!lstat) return res.status(404).json({});

        // delete
        if(lstat.isDirectory()) {
            if(req.query.recursive)
            res.status(200).json({ message: "deleted directory", path: path })

        } else {
            fs.rmSync(realPath)
            res.status(200).json({ message: "deleted file", path: path })
        }
    });
}
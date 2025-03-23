const fs = require('fs');

module.exports = (FFM) => {
    FFM.Router.get("/download", (req, res, next) => {
        /**
         * @description <host:port>/<prefix>/download?path=<path> to download file under <path>
         */
        if(!req.query.path) return res.status(400).json({});
        let file = FFM.tree(req.query.path, {detailed: true});
        if(file.code != 200) return res.status(404);

        if(file.type == "file") {
            if(req.headers.range) {
                let [start, end] = req.headers.range.replace(/bytes=/, "").split("-");
                if(end <= start || !end) end = file.size - 1;
                if (start >= file.size || end >= file.size) return res.status(416);

                let path = FFM.parsePath(req.query.path);
                let realPath = `${FFM.rootdir}/${path.join('/')}`;
                console.log(start)
                console.log(end)
                let fileStream = fs.createReadStream(realPath, { start: (+start), end: (+end) });
                if(!fileStream) return res.status(404);

                res.writeHead(206, {
                    "Content-Range": `bytes ${start}-${end}/${file.size}`,
                    "Accept-Ranges": "bytes",
                    "Content-Length": end - start + 1,
                    "Content-Type": "application/octet-stream",
                    /* "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
                    "Pragma": "no-cache",
                    "Expires": "0" */
                });
                return fileStream.pipe(res);

            } else {
                let path = FFM.parsePath(req.query.path);
                let realPath = `${FFM.rootdir}/${path.join('/')}`;
                let fileStream = fs.createReadStream(realPath);
                if(!fileStream) return res.status(404);

                res.writeHead(200, {
                    "Content-Length": file.size,
                    "Content-Type": "application/octet-stream",
                    "Content-Disposition": `attachment; filename="${file.path[file.path.length-1]}"`
                });
                return fileStream.pipe(res);

            }
        }
    })
}
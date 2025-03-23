module.exports = (FFM) => {
    /**
     * @description <host:port>/<prefix>/upload?path=<path> to upload file to <path>
     */
    FFM.Router.post("/upload", FFM.multer.any(), (req, res) => {
        res.json(
        req.files ? {
            message: "Pliki zapisane",
            files: req.files.map(file => ({
                originalName: file.originalname,
                savedAs: file.filename
            }))
        } : { message: "Brak Plików" }
        );
    });
}
module.exports = (FFM) => {
    FFM.Router.get("/dev", (req, res, next) => {
        /**
         * @description <host:port>/<prefix>/dev
        */
        res.status(200).json({
            name:"FoxFileManager",
            version:"1.0.0-A",
            author:"sudoTheFoxis",
            github:"https://github.com/sudoTheFoxis/FoxFileManager",
            testurls: [
                "http://localhost:3000/api/view?path=/",
                "http://localhost:3000/api/download?path=/public/icon.png",
                "http://localhost:3000/api/download?path=/.dev/sd%201.5.safetensors"
            ] 
        })
    });
}
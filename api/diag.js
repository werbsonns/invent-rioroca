export default function (req, res) {
    res.status(200).json({
        status: 'ok',
        message: 'Minimal diagnostic endpoint',
        env: process.env.NODE_ENV,
        cwd: process.cwd(),
        node: process.version,
        time: new Date().toISOString()
    });
}

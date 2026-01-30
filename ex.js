
'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const model = require('./model-mysql');
const fs = require('fs');
const cp=require('child_process');
const router = express.Router();
const cfg = require("eslib");
const RPTCDir = cfg.get("WCHTML_TEMP")
// Automatically parse request body as JSON
router.use(bodyParser.json());

function authRequired(req, res, next) {
    if (!req.user) {
        req.session.oauth2return = req.originalUrl;
        return res.redirect('/login');
    }
    return next();
}

//// Middleware that exposes the user's profile as well as login/logout URLs to
//// any templates. These are available as `profile`, `login`, and `logout`.
//function template  (req, res, next) {
//  res.locals.profile = req.user;
//  res.locals.login = `/auth/login?return=${encodeURIComponent(req.originalUrl)}`;
//  res.locals.logout = `/auth/logout?return=${encodeURIComponent(req.originalUrl)}`;
//  next();
//}
//// Use the oauth middleware to automatically get the user's profile
//// information and expose login/logout URLs to templates.
//router.use(template);

// Set Content-Type for all responses for these routes
router.use((req, res, next) => {
    res.set('Content-Type', 'text/html');
    next();
});

router.get('/exPDF', authRequired,async (req, res) => {
    res.render("RPTCenter/rpt_ex01.pug",{}, async (err,html_ctx)=>{
        let d=new Date();
        d=d.toLocaleString('sv').replace(/[.: -]/g,"")
        let outputPath=`${RPTCDir}${req.user.id}_${d}.txt`;
        fs.writeFileSync(outputPath, html_ctx);
        res.write(html_ctx);
        res.end(`<a >${outputPath}</a>`);
    
       })
});

function getClientIP(req){
    let ip=req.headers['x-forwarded-for']|| 
    req.connection.remoteAddress ||
    req.socket.remoteAddress||
    req.connection.socket.remoteAddress;
    let cip=ip.split(":").pop();
    return cip;
}

function SelfAuth(req,res,next){
    if(getClientIP(req)==1) return next();
    res.end("self auth")
}
router.get('/html/:book', SelfAuth,async (req, res) => {
    let outputPath = `${RPTCDir}${req.params.book}.txt`;
    if (fs.existsSync(outputPath)) {
        let html_contxt = await fs.readFileSync(outputPath);
        res.end(html_contxt);
    } else {
        res.end("no found.")
    }
});

const wkhtmltopdf="C:/code/tools/wkhtmltox/bin/wkhtmltopdf.exe";
const wvhtmltopdf="C:/code/tools/wvhtmltox/webview2pdf.exe";
const wchtmltopdf="C:/code/tools/wchtmltox/RooBrowser.exe";

function genwcpdf_run(cmdarg,callback){
	var ls = cp.spawn( wchtmltopdf /*command*/, cmdarg/*args*/, {}/*options, [optional]*/);
	var result='';
	ls.stdout.on('data', (data) => {result+=data.toString('utf8');});
	ls.on('close',function(code){return callback(result)});
}

router.get('/pdf/:book', authRequired,  (req, res, next) => {
    if(req.params.book.indexOf(req.user.id)<0) return res.end("error")
    const d=new Date();
    let dt_str=d.toLocaleString('sv').replace(/[- :]/g,"")
    let filename=`PPLL${dt_str}.PDF`;
    try{
      let fileurl=`HTTP://localhost/internal/RPTCenter/html/${req.params.book}`;
      let pdffile="C:/code/tools/wchtmltox/"+filename;
      genwcpdf_run([fileurl,filename,1],function(result){
          console.log(result)
          if (fs.existsSync(pdffile)) {
              res.setHeader("Content-type", "application/pdf");
              res.setHeader("Content-Disposition", "attachment; filename=" + encodeURI(filename) + ";");
              fs.createReadStream(pdffile).pipe(res);
          }else{
              res.writeHead(404, { 'Content-Type': 'text/html' });
              return res.end("404 Not Found");
          }
      });
    }catch(err)
    {
          res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end("exception:"+err);
    }
  });


/**
 * Errors on "/api/books/*" routes.
 */
router.use((err, req, res, next) => {
    // Format error and forward to generic error handler for logging and
    // responding to the request
    err.response = {
        message: err.message,
        internalCode: err.code,
    };
    next(err);
});

module.exports = router;

if(require.main==module){
    //code here for run stanalone
    

}

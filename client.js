window.__ModuleLoader__.load({
  id: 'dsbot-hub',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState } = React

    // The navigation entry renders in the DSH shell's bar, outside this panel,
    // so its stylesheet must live in the document rather than in the panel's
    // scoped <style>. Metrics mirror the shell's nav item; colors use the
    // shell's theme tokens because the panel's --dbh-* variables are not in
    // scope up there.
    const NAV_CSS = `
      .dbh-navitem{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;width:100%;height:100%;min-height:44px;margin:0;padding:4px 2px;border:0;border-radius:12px;background:transparent;color:var(--dsw-alias-label-tertiary,#81858c);font-family:inherit;font-size:10px;line-height:13px;letter-spacing:.01em;cursor:pointer;-webkit-tap-highlight-color:transparent}
      .dbh-navitem-icon{display:flex;align-items:center;justify-content:center;width:22px;height:22px;flex:none}
      .dbh-navitem-label{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .dbh-navitem.on{color:var(--dsw-alias-label-primary,#0f1115)}
      @media (hover:hover){.dbh-navitem:hover{color:var(--dsw-alias-label-secondary,#5b6067);background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05))}}
    `

    const PANEL_KEY = 'dsbot-hub'
    const LAST_SERVER = 'dsbot-hub:last-server'
    const FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Helvetica Neue",Helvetica,Arial,sans-serif'

    const CSS = `
      .dbh-root,.dbh-root *{box-sizing:border-box}
      .dbh-root{
        --dbh-bg:var(--dsw-alias-bg,#141414);
        --dbh-surface:var(--dsw-alias-surface,#1a1a1a);
        --dbh-raised:#202020;
        --dbh-hover:#272727;
        --dbh-sel:#232a3d;
        --dbh-line:var(--dsw-alias-border,#2d2d2d);
        --dbh-text:var(--dsw-alias-text,#f2f2f2);
        --dbh-muted:var(--dsw-alias-text-secondary,#9aa3ac);
        --dbh-accent:var(--dsw-alias-accent,#4d6bfe);
        --dbh-ok:#3fbf76;
        --dbh-work:#d9a441;
        --dbh-wait:#7c9cff;
        --dbh-bad:#ff6b6b;
        position:relative;height:100%;min-height:0;display:flex;flex-direction:column;
        background:var(--dbh-bg);color:var(--dbh-text);font:13px/1.45 ${FONT};overflow:hidden
      }
      .dbh-bar{
        position:relative;z-index:2;height:calc(44px + env(safe-area-inset-top));flex:none;display:flex;align-items:center;gap:4px;
        padding:0 8px;background:var(--dbh-bg);border-bottom:1px solid var(--dbh-line);
        padding-top:env(safe-area-inset-top)
      }
      .dbh-chip{
        position:relative;height:36px;max-width:min(460px,calc(100% - 208px));display:flex;align-items:center;gap:7px;
        border:1px solid var(--dbh-line);border-radius:8px;background:var(--dbh-raised);color:var(--dbh-text);
        padding:0 8px;font:inherit;font-size:12px;font-weight:600;cursor:pointer;text-align:left
      }
      .dbh-chip::after{content:"";position:absolute;inset:-4px;border-radius:inherit}
      .dbh-chip:hover{background:var(--dbh-hover)}
      .dbh-chip .dbh-chipicon{color:var(--dbh-muted);flex:none}
      .dbh-chip .dbh-label{max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .dbh-livechip{font-size:10.5px;font-weight:400;color:var(--dbh-muted);white-space:nowrap;max-width:150px;overflow:hidden;text-overflow:ellipsis}
      .dbh-caret{color:var(--dbh-muted);flex:none}
      .dbh-dot{width:7px;height:7px;border-radius:50%;background:#6b7280;flex:none}
      .dbh-dot.ok{background:var(--dbh-ok)}
      .dbh-dot.working{background:var(--dbh-work)}
      .dbh-dot.waiting{background:var(--dbh-wait)}
      .dbh-dot.bad{background:var(--dbh-bad)}
      .dbh-dot.checking{background:#6b7280}
      .dbh-grow{flex:1}
      .dbh-icon{
        width:44px;height:44px;border:0;border-radius:10px;background:transparent;color:var(--dbh-muted);
        display:flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none;flex:none
      }
      .dbh-icon:hover{background:var(--dbh-hover);color:var(--dbh-text)}
      .dbh-icon.on{background:var(--dbh-hover);color:var(--dbh-accent)}
      .dbh-content{position:relative;flex:1;min-height:0;display:flex;background:var(--dbh-bg)}
      .dbh-settings-overlay{position:absolute;inset:0;z-index:30;display:flex;min-height:0;background:var(--dbh-bg);overflow:hidden}
      .dbh-settings-overlay .dbh-settings{flex:1;min-height:0}
      .dbh-frame{flex:1;width:100%;height:100%;border:0;background:#141414;display:block;object-fit:cover;object-position:top}
      .dbh-framewrap{position:relative;flex:1;min-width:0;min-height:0;display:flex;background:var(--dbh-bg)}
      .dbh-framewrap .dbh-frame{width:100%;height:100%}
      .dbh-boot{
        position:absolute;inset:0;z-index:4;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;
        padding:24px;background-color:var(--dbh-bg);
        background-image:radial-gradient(circle at 1px 1px,rgba(255,255,255,.055) 1px,transparent 0);
        background-size:8px 8px;color:var(--dbh-text);text-align:center;
        transition:opacity 180ms cubic-bezier(.23,1,.32,1)
      }
      .dbh-boot.out{opacity:0;pointer-events:none}
      .dbh-boot-pod{position:relative;width:min(88vw,460px);height:clamp(150px,30vh,260px);flex:none;overflow:hidden}
      .dbh-boot-scene{position:absolute;left:50%;top:50%;width:390px;height:260px;transform-origin:center;overflow:hidden}
      .dbh-scene-whale{position:absolute;left:50%;top:50%;width:86px;line-height:0;will-change:transform,opacity;filter:drop-shadow(0 7px 10px rgba(0,0,0,.28))}
      .dbh-scene-whale-art{line-height:0}
      .dbh-scene-whale-art svg{display:block;width:100%;height:auto}
      .dbh-scene-drop{position:absolute;width:3px;height:3px;border-radius:50%;background:#ffffff;box-shadow:0 0 5px rgba(255,255,255,.55);opacity:0}
      .dbh-scene-ring{position:absolute;left:50%;top:50%;width:250px;height:105px;margin-left:-125px;margin-top:-52px;border:1px dashed rgba(120,140,190,.22);border-radius:50%;opacity:0}
      .dbh-scene-spark{position:absolute;width:6px;height:6px;border-radius:50%;background:#f4a62a;box-shadow:0 0 12px #f4a62a;opacity:0}
      .dbh-boot-title{max-width:88%;font-size:13.5px;line-height:1.3;font-weight:650;letter-spacing:.01em;animation:dbh-boot-copy-in 420ms cubic-bezier(.23,1,.32,1) 340ms both}
      .dbh-boot-sub{font-size:10px;line-height:1.2;font-weight:500;letter-spacing:0;text-transform:none;color:var(--dbh-muted);animation:dbh-boot-copy-in 380ms cubic-bezier(.23,1,.32,1) 420ms both}
      @keyframes dbh-boot-copy-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
      .dbh-boot.out .dbh-boot-whale,
      .dbh-boot.out .dbh-boot-bubble,
      .dbh-boot.out .dbh-boot-title,
      .dbh-boot.out .dbh-boot-sub{animation-play-state:paused}
      @media (prefers-reduced-motion:reduce){
        .dbh-boot{transition:none}
        .dbh-boot-whale,.dbh-boot-title,.dbh-boot-sub{animation:none!important;opacity:1!important}
        .dbh-boot-bubble{animation:none!important;opacity:.55!important;transform:none!important}
        .dbh-boot-whale{transform:scale(.7)!important}
      }
      .dbh-center{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:24px;background:var(--dbh-bg);color:var(--dbh-muted);font-size:12px}
      .dbh-spinner{width:18px;height:18px;border:2px solid var(--dbh-line);border-top-color:var(--dbh-accent);border-radius:50%;animation:dbh-spin .8s linear infinite}
      @keyframes dbh-spin{to{transform:rotate(360deg)}}
      @media (prefers-reduced-motion:reduce){.dbh-spinner{animation:none}}
      .dbh-cardwrap{flex:1;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow:auto;background:var(--dbh-bg)}
      .dbh-card{width:100%;max-width:400px;border:1px solid var(--dbh-line);border-radius:12px;background:var(--dbh-surface);padding:18px}
      .dbh-cardicon{width:28px;height:28px;border-radius:8px;border:1px solid var(--dbh-line);background:var(--dbh-raised);color:var(--dbh-muted);display:flex;align-items:center;justify-content:center}
      .dbh-card h2{font-size:14px;line-height:1.3;font-weight:650;margin:11px 0 4px;color:var(--dbh-text)}
      .dbh-card p{font-size:12px;line-height:1.55;color:var(--dbh-muted);margin:0 0 14px}
      .dbh-code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;line-height:1.65;color:var(--dbh-muted);background:var(--dbh-bg);border:1px solid var(--dbh-line);border-radius:8px;padding:9px 10px;margin:0 0 14px;white-space:pre-wrap;word-break:break-word}
      .dbh-row{display:flex;align-items:center;gap:8px}
      .dbh-row .dbh-input{flex:1;width:auto;min-width:0}
      .dbh-input{width:100%;height:34px;border:1px solid var(--dbh-line);border-radius:7px;background:var(--dbh-bg);color:var(--dbh-text);padding:0 10px;font:inherit;font-size:12px;outline:none}
      .dbh-input::placeholder{color:#6f7780}
      .dbh-input:focus{border-color:var(--dbh-accent);box-shadow:0 0 0 2px rgba(77,107,254,.18)}
      .dbh-btn{height:32px;border:0;border-radius:7px;background:var(--dbh-accent);color:#fff;font:inherit;font-size:12px;font-weight:600;padding:0 12px;cursor:pointer;white-space:nowrap}
      .dbh-btn:hover{filter:brightness(1.06)}
      .dbh-icon:focus-visible,.dbh-chip:focus-visible,.dbh-btn:focus-visible,.dbh-order:focus-visible,.dbh-back:focus-visible,.dbh-hosttoggle:focus-visible,.dbh-srow-edit:focus-visible,.dbh-navitem:focus-visible,.dbh-srow-main:focus-visible{outline:2px solid var(--dbh-accent);outline-offset:2px}
      .dbh-btn:disabled{opacity:.5;cursor:default}
      .dbh-btn.ghost{background:transparent;border:1px solid var(--dbh-line);color:var(--dbh-text)}
      .dbh-btn.ghost:hover{background:var(--dbh-hover)}
      .dbh-err{font-size:11px;line-height:1.45;color:var(--dbh-bad);margin-top:8px}
      .dbh-hint{font-size:10.5px;line-height:1.5;color:var(--dbh-muted);margin-top:11px}
      @media (max-width:700px){
        .dbh-bar a.dbh-icon{display:none}
        .dbh-chip{max-width:calc(100% - 164px)}
      }
      @media (max-width:420px){
        .dbh-livechip{display:none}
      }
      .dbh-popscrim{position:fixed;inset:0;z-index:40;background:transparent}
      .dbh-pop{position:absolute;top:46px;left:8px;z-index:41;width:320px;background:var(--dbh-raised);border:1px solid var(--dbh-line);border-radius:10px;box-shadow:0 16px 48px rgba(0,0,0,.5);padding:6px}
      .dbh-pophead,.dbh-sheethead{font-size:11px;color:var(--dbh-muted);font-weight:600;padding:7px 8px 5px}
      .dbh-popnote{font-size:10px;line-height:1.45;color:var(--dbh-muted);padding:8px 8px 5px;border-top:1px solid var(--dbh-line);margin-top:5px}
      .dbh-scrim{position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center}
      .dbh-sheet{width:100%;max-width:560px;max-height:76vh;background:var(--dbh-surface);border:1px solid var(--dbh-line);border-bottom:0;border-radius:16px 16px 0 0;padding:8px 10px calc(12px + env(safe-area-inset-bottom));box-shadow:0 -12px 40px rgba(0,0,0,.5);overflow:auto}
      .dbh-grab{width:34px;height:4px;border-radius:2px;background:var(--dbh-line);margin:2px auto 8px}
      .dbh-sheetnote{font-size:10px;line-height:1.45;color:var(--dbh-muted);padding:8px 8px 4px}
      .dbh-srvrow{
        width:100%;min-height:50px;display:flex;align-items:center;gap:9px;border:0;border-radius:8px;
        background:transparent;color:var(--dbh-text);font:inherit;text-align:left;padding:7px 8px;cursor:pointer
      }
      .dbh-srvrow:hover{background:var(--dbh-hover)}
      .dbh-srvrow.active{background:var(--dbh-sel)}
      .dbh-srvav{width:26px;height:26px;border-radius:7px;border:1px solid var(--dbh-line);background:var(--dbh-bg);color:var(--dbh-muted);display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:700;flex:none}
      .dbh-srvbody{min-width:0;flex:1}
      .dbh-srvname{display:block;font-size:12.5px;line-height:1.2;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .dbh-srvmeta{display:block;font-size:10.5px;line-height:1.35;color:var(--dbh-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .dbh-srvmeta.work{color:var(--dbh-work)}
      .dbh-srvmeta.wait{color:var(--dbh-wait)}
      .dbh-srvmeta.bad{color:var(--dbh-bad)}
      .dbh-check{color:var(--dbh-accent);flex:none;display:flex}

      .dbh-settings{flex:1;min-height:0;overflow:auto;background:var(--dbh-bg);padding:18px 16px 40px}
      .dbh-settings-inner{width:100%;max-width:680px;margin:0 auto}
      .dbh-settings-head{display:flex;align-items:center;gap:8px;min-height:44px}
      .dbh-settings-title{font-size:16px;font-weight:600;letter-spacing:-.01em}
      .dbh-settings-sub{font-size:12px;line-height:1.5;color:var(--dbh-muted);margin:6px 0 16px;max-width:520px}
      .dbh-back{width:44px;height:44px;border:0;border-radius:10px;background:transparent;color:var(--dbh-muted);display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none}
      .dbh-back:hover{background:var(--dbh-hover);color:var(--dbh-text)}
      .dbh-add{display:inline-flex;align-items:center;gap:6px}
      .dbh-hosttoggle{width:auto;min-width:44px;height:44px;padding:0 10px;gap:6px;border:0;border-radius:10px;background:transparent;color:var(--dbh-muted);display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;font:inherit;font-size:11px;font-weight:600}
      .dbh-hostlabel{line-height:1;white-space:nowrap}
      @media (max-width:360px){.dbh-hostlabel{display:none}.dbh-hosttoggle{width:44px;padding:0}}
      .dbh-hosttoggle:hover{background:var(--dbh-hover);color:var(--dbh-text)}
      .dbh-hosttoggle.on{background:var(--dbh-hover);color:var(--dbh-accent)}
      .dbh-slist{border-top:1px solid var(--dbh-line)}
      .dbh-srow{display:flex;align-items:center;gap:8px;padding:9px 2px;border-bottom:1px solid var(--dbh-line)}
      .dbh-srow-order{display:flex;flex-direction:column;gap:1px;flex:none;padding:1px;border:0;border-radius:6px;background:transparent;opacity:.7;transition:opacity 150ms ease}
      .dbh-srow:hover .dbh-srow-order,.dbh-srow:focus-within .dbh-srow-order{opacity:1}
      .dbh-order{width:30px;height:30px;border:0;border-radius:6px;background:transparent;color:var(--dbh-muted);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0}
      .dbh-order:hover:not(:disabled){background:var(--dbh-hover);color:var(--dbh-text)}
      .dbh-order:disabled{opacity:.3;cursor:default}
      .dbh-srow-main{flex:1;min-width:0;display:flex;align-items:center;gap:9px;background:transparent;border:0;color:inherit;font:inherit;text-align:left;cursor:pointer;padding:2px 0}
      .dbh-srow-av{width:30px;height:30px;border-radius:8px;border:1px solid var(--mark-line,var(--dbh-line));background:var(--mark-bg,var(--dbh-raised));color:var(--mark-fg,var(--dbh-muted));display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:600;flex:none;position:relative;box-shadow:inset 0 1px 0 rgba(255,255,255,.045)}
      .dbh-markdot{position:absolute;right:-2px;bottom:-2px;width:8px;height:8px;border-radius:50%;border:2px solid var(--dbh-bg);background:#6b7280;flex:none}
      .dbh-markdot.ok{background:var(--dbh-ok)}
      .dbh-markdot.working{background:var(--dbh-work)}
      .dbh-markdot.waiting{background:var(--dbh-wait)}
      .dbh-markdot.bad{background:var(--dbh-bad)}
      .dbh-srow-body{min-width:0;flex:1}
      .dbh-srow-name{display:block;font-size:12.5px;font-weight:600;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .dbh-srow-meta{display:block;font-size:11px;line-height:1.35;color:var(--dbh-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .dbh-srow-status{display:flex;align-items:center;gap:5px;font-size:10.5px;color:var(--dbh-muted);flex:none;max-width:170px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .dbh-srow-status.work{color:var(--dbh-work)}
      .dbh-srow-status.wait{color:var(--dbh-wait)}
      .dbh-srow-status.bad{color:var(--dbh-bad)}
      .dbh-srow-edit{width:44px;height:44px;border:0;background:transparent;color:var(--dbh-muted);display:flex;align-items:center;justify-content:center;border-radius:10px;cursor:pointer;flex:none}
      .dbh-srow-edit:hover{background:var(--dbh-hover);color:var(--dbh-text)}
      .dbh-empty{padding:26px 4px;color:var(--dbh-muted);font-size:12px;line-height:1.55}
      .dbh-form{max-width:480px}
      .dbh-field{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}
      .dbh-field>label{font-size:12px;font-weight:600;color:var(--dbh-text)}
      .dbh-field .dbh-input{height:36px}
      .dbh-field-hint{font-size:11.5px;line-height:1.45;color:var(--dbh-muted)}
      .dbh-form-actions{display:flex;align-items:center;gap:8px;margin-top:16px;flex-wrap:wrap}
      .dbh-form-note{font-size:10.5px;line-height:1.5;color:var(--dbh-muted);margin-top:18px;max-width:480px}
      .dbh-settings .dbh-btn{display:inline-flex;align-items:center;justify-content:center;gap:5px}
      .dbh-btn.danger{background:var(--dbh-bad);border-color:var(--dbh-bad);color:#1b0d0d}
      .dbh-danger{border:0;background:transparent;color:var(--dbh-bad);font:inherit;font-size:13px;font-weight:600;padding:0 12px;height:44px;border-radius:9px;cursor:pointer;margin-left:auto}
      .dbh-danger:hover{background:rgba(255,107,107,.1)}
      .dbh-danger-zone{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:16px;padding-top:16px;border-top:1px solid var(--dbh-line);max-width:480px}
      .dbh-danger-copy{font-size:11.5px;line-height:1.5;color:var(--dbh-muted);max-width:310px}
      .dbh-danger-copy strong{color:var(--dbh-text);font-weight:600}
      .dbh-danger-zone .dbh-danger{margin-left:0}
      .dbh-confirm{margin-top:14px;border:1px solid rgba(255,107,107,.35);background:rgba(255,107,107,.06);border-radius:8px;padding:10px 12px;font-size:11.5px;line-height:1.5;color:var(--dbh-muted);max-width:480px}
      .dbh-confirm strong{color:var(--dbh-text);font-weight:600}
      .dbh-confirm-actions{display:flex;gap:8px;margin-top:9px}
      .dbh-advanced{border-top:1px solid var(--dbh-line);margin:16px 0;padding-top:4px}
      .dbh-advanced summary{display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:pointer;font-size:12px;font-weight:600;color:var(--dbh-muted);list-style:none;outline:none;padding:0 2px;min-height:44px}
      .dbh-advanced summary svg{transition:transform .12s ease}
      .dbh-advanced[open] summary svg{transform:rotate(180deg)}
      .dbh-advanced summary::-webkit-details-marker{display:none}
      .dbh-advanced[open] summary{margin-bottom:12px}
      @media (max-width:1023px){
        .dbh-popscrim,.dbh-pop{display:none}
        .dbh-chip .dbh-label{max-width:130px}
        .dbh-livechip{max-width:88px}
        .dbh-settings{padding:14px 12px 32px}
        .dbh-settings-title{font-size:15px}
        .dbh-srow-status{max-width:104px}
        .dbh-srow-meta{font-size:11px}
      }
      @media (min-width:1024px){
        .dbh-scrim{display:none}
      }
      @media (min-width:701px) and (max-width:1024px){
        .dbh-bar{height:calc(56px + env(safe-area-inset-top));padding:0 10px;gap:4px}
        .dbh-chip{height:44px;max-width:calc(100% - 168px);padding:0 12px;border-radius:11px;font-size:13px}
        .dbh-chip .dbh-label{max-width:calc(100vw - 290px)}
        .dbh-icon{width:44px;height:44px;border-radius:10px}
        .dbh-sheet{max-height:72vh;border-radius:20px 20px 0 0;padding:12px 16px calc(18px + env(safe-area-inset-bottom))}
        .dbh-sheethead{font-size:16px;padding:2px 4px 10px}
        .dbh-srow{min-height:60px;padding:8px 6px}
        .dbh-srow-status{display:none}
        .dbh-input, .dbh-row .dbh-input{min-height:44px;font-size:16px}
        .dbh-btn{min-height:44px;font-size:14px}
        .dbh-settings{padding:16px}
        .dbh-settings-inner{max-width:100%}
      }
      .dbh-mnav{display:none}
      .dbh-mobilepage{flex:1;min-height:0;display:flex;flex-direction:column;background:var(--dbh-bg);padding:calc(12px + env(safe-area-inset-top)) 16px calc(16px + env(safe-area-inset-bottom));overflow:auto}
      .dbh-mobilehead{padding:8px 0 14px;border-bottom:1px solid var(--dbh-line);margin-bottom:8px}
      .dbh-mobilehead h2{font-size:20px;font-weight:600;margin:0 0 4px}
      .dbh-mobilehead p{font-size:12px;line-height:1.5;color:var(--dbh-muted);margin:0;max-width:340px}
      .dbh-mobilelist{display:flex;flex-direction:column;gap:4px;padding:4px 0}
      .dbh-mobileadd{margin-top:16px;width:100%}
      @media (max-width:700px){
        .dbh-mnav{display:flex;flex:none;height:calc(56px + env(safe-area-inset-bottom));padding:4px 8px env(safe-area-inset-bottom);border-top:1px solid var(--dbh-line);background:var(--dbh-bg);gap:4px}
        .dbh-mnav-btn{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:0;border-radius:10px;background:transparent;color:var(--dbh-muted);font:inherit;font-size:10px;letter-spacing:.01em;cursor:pointer}
        .dbh-mnav-btn.on{background:var(--dbh-sel);color:var(--dbh-text)}
        .dbh-mnav-btn svg{opacity:.9}
        .dbh-content{padding-bottom:0}
      }
      @media (max-width:700px){
        .dbh-bar{height:calc(52px + env(safe-area-inset-top));gap:2px;padding:0 6px}
        .dbh-chip{height:44px;max-width:calc(100% - 144px);padding:0 10px;border-radius:10px;font-size:13px}
        .dbh-chip .dbh-label{max-width:calc(100vw - 232px)}
        .dbh-livechip{display:none}
        .dbh-icon{width:44px;height:44px;border-radius:10px}
        .dbh-content{background:var(--dbh-bg)}
        .dbh-sheet{max-height:84vh;border-radius:20px 20px 0 0;padding:10px 12px calc(16px + env(safe-area-inset-bottom))}
        .dbh-pop{display:none}
        .dbh-grab{width:36px;height:4px;margin:2px auto 10px}
        .dbh-sheethead{font-size:15px;padding:2px 4px 8px}
        .dbh-srow{min-height:64px;padding:6px 4px}
        .dbh-srow-main{gap:12px}
        .dbh-srow-status{display:none}
        .dbh-settings{padding:12px}
        .dbh-settings-inner{max-width:100%}
        .dbh-input, .dbh-row .dbh-input{min-height:44px;font-size:16px}
        .dbh-btn{min-height:44px;font-size:14px}
        .dbh-cardwrap{padding:16px 12px}
        .dbh-card{padding:16px}
        .dbh-danger-zone{gap:10px}
        .dbh-confirm{padding:12px}
      }
    `

    function statusText(status) {
      if (status === 'unauthorized') return 'sign in'
      if (status === 'unreachable') return 'unreachable'
      if (status === 'incompatible') return 'incompatible'
      if (status === 'misconfigured') return 'check proxy'
      if (status === 'checking') return 'checking'
      return status || 'idle'
    }

    function statusClass(server) {
      if (server === undefined) return 'checking'
      if (server.status !== 'ok') return 'bad'
      if (server.live?.waiting > 0) return 'waiting'
      if (server.live?.working > 0) return 'working'
      return 'ok'
    }

    function compactLive(server) {
      if (server === undefined) return ''
      if (server.status !== 'ok') return statusText(server.status)
      if (server.live?.waiting > 0) return `${server.live.waiting} waiting`
      if (server.live?.working > 0) return `${server.live.working} working`
      return 'idle'
    }

    function formatElapsed(ms) {
      if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return ''
      const minutes = Math.floor(ms / 60000)
      if (minutes < 1) return ''
      if (minutes < 60) return `${minutes}m`
      return `${Math.floor(minutes / 60)}h`
    }

    function liveDetail(server) {
      if (server === undefined) return ''
      if (server.status !== 'ok') return statusText(server.status)
      if (server.live?.waiting > 0) return `${server.live.waiting} waiting`
      if (server.live?.working > 0) {
        let text = `${server.live.working} working`
        if (server.live.current) text += ` · ${server.live.current}`
        const elapsed = formatElapsed(server.live.elapsedMs)
        if (elapsed !== '') text += ` ${elapsed}`
        return text
      }
      return 'idle'
    }

    function liveTone(server) {
      if (server === undefined || server.status !== 'ok') return 'bad'
      if (server.live?.waiting > 0) return 'wait'
      if (server.live?.working > 0) return 'work'
      return ''
    }

    function trapTab(event, container) {
      if (event.key !== 'Tab' || container === null) return
      const focusable = [...container.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
        .filter(element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden')
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && (document.activeElement === first || document.activeElement === container)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    function plural(count, one, many) {
      return `${count} ${count === 1 ? one : many}`
    }

    function Icon(props) {
      const size = typeof props.size === 'number' ? props.size : 16
      const common = {
        viewBox: '0 0 24 24', width: size, height: size, fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true, className: props.className,
      }
      if (props.name === 'server') {
        return h('svg', common,
          h('rect', { x: 3, y: 4, width: 18, height: 6, rx: 2 }),
          h('rect', { x: 3, y: 14, width: 18, height: 6, rx: 2 }),
          h('circle', { cx: 7, cy: 7, r: 0.9, fill: 'currentColor', stroke: 'none' }),
          h('circle', { cx: 7, cy: 17, r: 0.9, fill: 'currentColor', stroke: 'none' }))
      }
      if (props.name === 'refresh') {
        return h('svg', common, h('path', { d: 'M20 12a8 8 0 1 1-2.34-5.66' }), h('path', { d: 'M20 4v5h-5' }))
      }
      if (props.name === 'external') {
        return h('svg', common,
          h('path', { d: 'M14 4h6v6' }),
          h('path', { d: 'M20 4l-9 9' }),
          h('path', { d: 'M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4' }))
      }
      if (props.name === 'chevron') return h('svg', common, h('path', { d: 'M6 9l6 6 6-6' }))
      if (props.name === 'check') return h('svg', common, h('path', { d: 'M20 6L9 17l-5-5' }))
      if (props.name === 'lock') {
        return h('svg', common, h('rect', { x: 4, y: 10, width: 16, height: 10, rx: 2 }), h('path', { d: 'M8 10V7a4 4 0 0 1 8 0v3' }))
      }
      if (props.name === 'warning') {
        return h('svg', common,
          h('path', { d: 'M12 3l9 16H3z' }),
          h('path', { d: 'M12 9v4' }),
          h('circle', { cx: 12, cy: 17, r: 0.9, fill: 'currentColor', stroke: 'none' }))
      }
      if (props.name === 'settings') {
        return h('svg', common,
          h('circle', { cx: 12, cy: 12, r: 3 }),
          h('path', { d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' }))
      }
      if (props.name === 'eye') {
        return h('svg', common,
          h('path', { d: 'M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z' }),
          h('circle', { cx: 12, cy: 12, r: 3 }))
      }
      if (props.name === 'eyeOff') {
        return h('svg', common,
          h('path', { d: 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24' }),
          h('path', { d: 'M1 1l22 22' }))
      }
      if (props.name === 'chat') {
        return h('svg', common,
          h('path', { d: 'M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z' }))
      }
      if (props.name === 'panelRight') {
        return h('svg', common,
          h('rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 }),
          h('path', { d: 'M15 4v16' }))
      }
      if (props.name === 'plus') return h('svg', common, h('path', { d: 'M12 5v14M5 12h14' }))
      if (props.name === 'back') return h('svg', common, h('path', { d: 'M15 18l-6-6 6-6' }))
      if (props.name === 'up') return h('svg', common, h('path', { d: 'M6 15l6-6 6 6' }))
      if (props.name === 'down') return h('svg', common, h('path', { d: 'M6 9l6 6 6-6' }))
      return null
    }

    function ServersIcon(props) {
      const size = typeof props?.size === 'number' ? props.size : 20
      return h(Icon, { name: 'server', size })
    }


    function slugifyLabel(value) {
      return String(value ?? '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48)
    }

    function uniqueServerId(label, existing) {
      const base = slugifyLabel(label) || 'server'
      const taken = new Set(existing)
      let id = base
      let index = 2
      while (taken.has(id)) {
        id = `${base}-${index}`
        index += 1
      }
      return id
    }

    function initialOf(server) {
      return String(server.label || server.id || '?').trim().charAt(0).toUpperCase() || '?'
    }

    const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1'])

    const SERVER_MARKS = [
      { bg: 'rgba(120, 160, 255, .16)', fg: '#b4c8ff', line: 'rgba(120, 160, 255, .32)' },
      { bg: 'rgba(120, 195, 150, .14)', fg: '#a9dfbc', line: 'rgba(120, 195, 150, .30)' },
      { bg: 'rgba(220, 170, 80, .14)', fg: '#eccb86', line: 'rgba(220, 170, 80, .30)' },
      { bg: 'rgba(200, 140, 225, .15)', fg: '#e0b9f0', line: 'rgba(200, 140, 225, .31)' },
      { bg: 'rgba(235, 135, 125, .14)', fg: '#f2b0a7', line: 'rgba(235, 135, 125, .30)' },
      { bg: 'rgba(130, 175, 205, .15)', fg: '#b2d2e6', line: 'rgba(130, 175, 205, .31)' },
      { bg: 'rgba(170, 215, 200, .14)', fg: '#b9e3d8', line: 'rgba(170, 215, 200, .30)' },
      { bg: 'rgba(200, 180, 140, .14)', fg: '#dcc9a3', line: 'rgba(200, 180, 140, .30)' },
      { bg: 'rgba(175, 160, 235, .15)', fg: '#c9bdf5', line: 'rgba(175, 160, 235, .31)' },
      { bg: 'rgba(190, 160, 170, .14)', fg: '#d8bcc4', line: 'rgba(190, 160, 170, .30)' },
    ]

    function markStyle(server) {
      const key = String(server.id || server.label || '')
      let hash = 0
      for (let index = 0; index < key.length; index += 1) hash = (hash * 31 + key.charCodeAt(index)) >>> 0
      const mark = SERVER_MARKS[hash % SERVER_MARKS.length]
      return { '--mark-bg': mark.bg, '--mark-fg': mark.fg, '--mark-line': mark.line }
    }

    function SettingsView({ servers, onClose, onChanged, layerId = 'hub-settings' }) {
      const [screen, setScreen] = useState('list')
      const [editingId, setEditingId] = useState('')
      const [draft, setDraft] = useState({ id: '', label: '', endpoint: '', cookieRef: '', token: '' })
      const [saving, setSaving] = useState(false)
      const [error, setError] = useState('')
      const [fieldErrors, setFieldErrors] = useState({})
      const [loginErrors, setLoginErrors] = useState([])
      const [confirm, setConfirm] = useState(false)
      const [showHosts, setShowHosts] = useState(false)

      const openAdd = () => {
        setEditingId('')
        setDraft({ id: '', label: '', endpoint: '', cookieRef: '', token: '' })
        setScreen('add')
        setError('')
        setFieldErrors({})
        setLoginErrors([])
        setConfirm(false)
      }

      const openEdit = server => {
        setEditingId(server.id)
        setDraft({
          id: server.id,
          label: server.label ?? server.id,
          endpoint: server.endpoint ?? '',
          cookieRef: server.cookieRef ?? '',
          token: '',
        })
        setScreen('edit')
        setError('')
        setFieldErrors({})
        setLoginErrors([])
        setConfirm(false)
      }

      const backToList = () => {
        setScreen('list')
        setError('')
        setFieldErrors({})
        setConfirm(false)
      }

      useHubBackLayer(`${layerId}:${screen}`, true, () => {
        if (screen === 'list') onClose()
        else backToList()
      })

      const requestServers = list => list.map(server => ({
        id: server.id,
        label: server.label,
        endpoint: server.endpoint,
        cookieRef: server.cookieRef ?? '',
      }))

      const persist = async (list, tokens = {}) => {
        if (saving) return false
        setSaving(true)
        setError('')
        setFieldErrors({})
        setLoginErrors([])
        try {
          const response = await fetch('/dsbot-hub/api/settings/servers', {
            method: 'PUT',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ servers: requestServers(list), tokens }),
          })
          const body = await response.json().catch(() => ({}))
          if (!response.ok || body.ok !== true) {
            setError(typeof body.error === 'string' ? body.error : `Save failed (${response.status}).`)
            if (Array.isArray(body.fields)) {
              const next = {}
              for (const entry of body.fields) {
                if (entry !== null && typeof entry === 'object' && typeof entry.field === 'string') {
                  next[entry.field] = typeof entry.message === 'string' ? entry.message : 'Invalid'
                }
              }
              setFieldErrors(next)
            }
            return false
          }
          if (Array.isArray(body.loginErrors) && body.loginErrors.length > 0) setLoginErrors(body.loginErrors)
          onChanged()
          setScreen('list')
          setConfirm(false)
          return true
        } catch (failure) {
          setError(String(failure?.message ?? failure))
          return false
        } finally {
          setSaving(false)
        }
      }

      const validate = () => {
        const errors = {}
        if (draft.label.trim() === '') errors.label = 'A name is required.'
        if (!/^https?:\/\//i.test(draft.endpoint.trim())) errors.endpoint = 'An http(s) endpoint is required.'
        if (draft.id.trim() !== '' && !/^[a-z0-9][a-z0-9_-]*$/i.test(draft.id.trim())) errors.id = 'Use letters, numbers, hyphens and underscores.'
        if (draft.cookieRef.trim() !== '' && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(draft.cookieRef.trim())) errors.cookieRef = 'Use an environment-style name.'
        setFieldErrors(errors)
        return Object.keys(errors).length === 0
      }

      const save = async () => {
        if (saving || !validate()) return
        const id = editingId || draft.id.trim() || uniqueServerId(draft.label, servers.map(server => server.id))
        const entry = {
          id,
          label: draft.label.trim(),
          endpoint: draft.endpoint.trim().replace(/\/+$/, ''),
          cookieRef: draft.cookieRef.trim(),
        }
        const next = servers.map(server => ({
          id: server.id,
          label: server.label,
          endpoint: server.endpoint,
          cookieRef: server.cookieRef ?? '',
        }))
        const index = next.findIndex(server => server.id === editingId)
        if (index >= 0) next[index] = entry
        else next.push(entry)
        const tokens = draft.token.trim() !== '' ? { [id]: draft.token.trim() } : {}
        await persist(next, tokens)
      }

      const move = async (index, delta) => {
        if (saving) return
        const target = index + delta
        if (target < 0 || target >= servers.length) return
        const next = servers.slice()
        const [item] = next.splice(index, 1)
        next.splice(target, 0, item)
        await persist(next)
      }

      const remove = async () => {
        if (saving) return
        await persist(servers.filter(server => server.id !== editingId))
      }

      const rootRef = useRef(null)
      const onCloseRef = useRef(onClose)
      onCloseRef.current = onClose
      useEffect(() => {
        rootRef.current?.focus?.()
        const onKey = event => {
          if (event.key !== 'Escape') return
          if (screen !== 'list') {
            backToList()
            return
          }
          onCloseRef.current?.()
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
      }, [screen])

      const field = (label, key, hint, type = 'text') => h('div', { className: 'dbh-field' },
        h('label', { htmlFor: `dbh-${key}` }, label),
        h('input', {
          id: `dbh-${key}`,
          className: 'dbh-input',
          type,
          value: draft[key],
          autoComplete: 'off',
          spellCheck: false,
          disabled: saving || (key === 'id' && screen === 'edit'),
          onChange: event => setDraft(current => ({ ...current, [key]: event.target.value })),
        }),
        hint ? h('span', { className: 'dbh-field-hint' }, hint) : null,
        fieldErrors[key] ? h('span', { className: 'dbh-err' }, fieldErrors[key]) : null)

      const statusLabel = server => server.status === 'ok' ? liveDetail(server) : statusText(server.status)
      const errorLine = error !== '' ? h('div', { className: 'dbh-err', role: 'alert' }, error) : null
      const loginLine = loginErrors.length > 0
        ? h('div', { className: 'dbh-err', role: 'alert' }, 'Saved, but sign-in failed: ', loginErrors.map(entry => `${entry.id} — ${entry.message}`).join(' · '))
        : null

      const rows = servers.map((server, index) => h('div', { className: 'dbh-srow', key: server.id },
        h('div', { className: 'dbh-srow-order' },
          h('button', {
            className: 'dbh-order', type: 'button', title: 'Move up', 'aria-label': `Move ${server.label} up`,
            disabled: index === 0 || saving, onClick: () => void move(index, -1),
          }, h(Icon, { name: 'up', size: 12 })),
          h('button', {
            className: 'dbh-order', type: 'button', title: 'Move down', 'aria-label': `Move ${server.label} down`,
            disabled: index === servers.length - 1 || saving, onClick: () => void move(index, 1),
          }, h(Icon, { name: 'down', size: 12 }))),
        h('button', { className: 'dbh-srow-main', type: 'button', 'aria-label': `${server.label} — ${statusLabel(server)}`, onClick: () => openEdit(server) },
          h('span', { className: 'dbh-srow-av', style: markStyle(server), 'aria-hidden': 'true' },
            initialOf(server),
            h('span', { className: `dbh-markdot ${statusClass(server)}` })),
          h('span', { className: 'dbh-srow-body' },
            h('span', { className: 'dbh-srow-name' }, server.label),
            h('span', { className: 'dbh-srow-meta' }, showHosts ? `Origin ${server.origin}` : 'Addresses hidden'))),
        h('span', { className: `dbh-srow-status ${liveTone(server)}` }, statusLabel(server)),
        h('button', {
          className: 'dbh-srow-edit', type: 'button', title: `Edit ${server.label}`, 'aria-label': `Edit ${server.label}`,
          onClick: () => openEdit(server),
        }, h(Icon, { name: 'chevron', size: 14 }))))

      const listView = h('div', null,
        h('div', { className: 'dbh-settings-head' },
          h('button', { className: 'dbh-back', type: 'button', title: 'Back to the hub', 'aria-label': 'Back to the hub', onClick: onClose },
            h(Icon, { name: 'back', size: 16 })),
          h('div', { className: 'dbh-settings-title' }, 'Servers'),
          h('div', { className: 'dbh-grow' }),
          h('button', {
            className: `dbh-hosttoggle${showHosts ? ' on' : ''}`,
            type: 'button',
            title: showHosts ? 'Hide host addresses' : 'Show host addresses',
            'aria-label': showHosts ? 'Hide host addresses' : 'Show host addresses',
            'aria-pressed': showHosts,
            onClick: () => setShowHosts(value => !value),
          }, h(Icon, { name: showHosts ? 'eye' : 'eyeOff', size: 15 }), h('span', { className: 'dbh-hostlabel' }, 'Hosts')),
          h('button', { className: 'dbh-btn dbh-add', type: 'button', onClick: openAdd, disabled: saving },
            h(Icon, { name: 'plus', size: 14 }), 'Add server')),
        h('p', { className: 'dbh-settings-sub' }, 'The DS Bot teams this hub can reach. This is the order shown in the switcher.'),
        errorLine,
        loginLine,
        servers.length === 0
          ? h('div', { className: 'dbh-empty' }, 'No servers yet. Add one to bring a DS Bot team into the hub.')
          : h('div', { className: 'dbh-slist' }, rows),
        h('div', { className: 'dbh-form-note' }, 'Saved to this DSH profile. The team, chats and memory stay on their server.'))

      const form = h('form', {
        className: 'dbh-form',
        onSubmit: event => { event.preventDefault(); void save() },
      },
        field('Name', 'label', 'Shown in the switcher and in tool results.'),
        field('Endpoint', 'endpoint', 'The DS Bot address the hub connects to, e.g. http://127.0.0.1:8080.'),
        field('Login token', 'token',
          screen === 'edit'
            ? 'Optional. Paste a fresh login URL or token to replace the stored cookie.'
            : 'Optional. The login URL or token the DS Bot prints; stored as a DSH secret.',
          'password'),
        h('details', { className: 'dbh-advanced' },
          h('summary', null, h('span', null, 'Advanced'), h(Icon, { name: 'chevron', size: 12 })),
          field('Server id', 'id', 'Used in tool names. Letters, numbers, hyphens; set at creation.'),
          field('Cookie reference', 'cookieRef', 'The DSH secret name. Leave blank for DSBOT_<ID>_COOKIE.')),
        errorLine,
        loginLine,
        h('div', { className: 'dbh-form-actions' },
          h('button', { className: 'dbh-btn', type: 'submit', disabled: saving },
            saving ? 'Saving…' : screen === 'add' ? 'Add server' : 'Save changes'),
          h('button', { className: 'dbh-btn ghost', type: 'button', onClick: backToList, disabled: saving }, 'Cancel')),
        h('div', { className: 'dbh-form-note' }, 'Saved to this DSH profile. Team data stays on its server.'),
        screen === 'edit'
          ? h('div', { className: 'dbh-danger-zone' },
            h('div', { className: 'dbh-danger-copy' },
              'Remove ', h('strong', null, draft.label || 'this server'), ' from the hub. Its team, chats and memory stay on the server.'),
            h('button', { className: 'dbh-danger', type: 'button', onClick: () => setConfirm(true), disabled: saving }, 'Delete server'))
          : null,
        confirm
          ? h('div', { className: 'dbh-confirm' },
            h('div', null, 'Delete ', h('strong', null, draft.label || 'this server'), ' from the hub? Its team, chats and memory stay on the server.'),
            h('div', { className: 'dbh-confirm-actions' },
              h('button', { className: 'dbh-btn danger', type: 'button', onClick: () => void remove(), disabled: saving }, 'Delete'),
              h('button', { className: 'dbh-btn ghost', type: 'button', onClick: () => setConfirm(false), disabled: saving }, 'Keep')))
          : null)

      const formView = h('div', null,
        h('div', { className: 'dbh-settings-head' },
          h('button', { className: 'dbh-back', type: 'button', title: 'Back to servers', 'aria-label': 'Back to servers', onClick: backToList },
            h(Icon, { name: 'back', size: 16 })),
          h('div', { className: 'dbh-settings-title' }, screen === 'add' ? 'Add server' : 'Edit server')),
        h('p', { className: 'dbh-settings-sub' },
          screen === 'add'
            ? 'Connect the hub to a DS Bot server. It gets a private browser address automatically.'
            : 'Rename, repoint or sign in to this server.'),
        form)

      return h('div', { className: 'dbh-settings', ref: rootRef, tabIndex: -1, onKeyDown: event => trapTab(event, event.currentTarget) },
        h('div', { className: 'dbh-settings-inner' }, screen === 'list' ? listView : formView))
    }

    // The DSH shell publishes the active presentation on the document element
    // (ui-layout, MOBILE_MAX_WIDTH). Inside that shell DSH owns the bottom
    // navigation, so the hub drops its own bar and keeps server switching in the
    // top bar's chip sheet; standalone (no DSH shell) keeps the hub's own bar.
    function useShellMobile() {
      const read = () => document.documentElement.getAttribute('data-dsh-shell') === 'mobile'
      const [mobile, setMobile] = useState(read)
      useEffect(() => {
        const observer = new MutationObserver(() => setMobile(read()))
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-dsh-shell'] })
        return () => observer.disconnect()
      }, [])
      return mobile
    }

    // The hub's destination in the DSH mobile navigation: the DS Bot surface.
    // It matches the shell's nav item metrics (56px cell, 20px glyph, 10px label)
    // because the shell only owns the bar around it.
    function ServersTab({ usePanelInfo, openServers }) {
      const active = usePanelInfo(info => info.activePanelId === PANEL_KEY)
      return h('button', {
        type: 'button',
        className: `dbh-navitem${active ? ' on' : ''}`,
        'aria-current': active ? 'page' : undefined,
        onClick: openServers,
      },
        h('span', { className: 'dbh-navitem-icon', 'aria-hidden': 'true' }, h(Icon, { name: 'server', size: 20 })),
        h('span', { className: 'dbh-navitem-label' }, 'Bots'))
    }

    const WHALE_SVG = "<svg viewBox=\"0 0 100 100\"><defs><mask id=\"bt-mark-1\" maskUnits=\"userSpaceOnUse\" x=\"-100\" y=\"-100\" width=\"300\" height=\"300\"><rect x=\"-100\" y=\"-100\" width=\"300\" height=\"300\" fill=\"#fff\"></rect><g class=\"bt-gaze\"><g class=\"bt-eyes\" fill=\"#000\"><g transform=\"translate(72.5 48.4) rotate(-15.8)\"><rect class=\"bt-eye\" x=\"-4.65\" y=\"-11.5\" width=\"9.3\" height=\"23\" rx=\"4.65\"></rect></g><g transform=\"translate(85.6 43.4) rotate(-21.2)\"><rect class=\"bt-eye\" x=\"-3.5\" y=\"-11.45\" width=\"7\" height=\"22.9\" rx=\"3.5\"></rect></g><g transform=\"translate(72.5 48.4) rotate(-15.8)\"><path class=\"bt-eye-happy\" opacity=\"0\" d=\"M-5.766 3.22Q0 -9.66 5.766 3.22\" fill=\"none\" stroke=\"#000\" stroke-width=\"4.65\" stroke-linecap=\"round\"></path></g><g transform=\"translate(85.6 43.4) rotate(-21.2)\"><path class=\"bt-eye-happy\" opacity=\"0\" d=\"M-4.34 3.206Q0 -9.617999999999999 4.34 3.206\" fill=\"none\" stroke=\"#000\" stroke-width=\"3.5\" stroke-linecap=\"round\"></path></g></g></g></mask></defs><g class=\"bt-b\"><g mask=\"url(#bt-mark-1)\"><g fill-rule=\"evenodd\"><path d=\"M65.3 20.9l5.1 .1 4.8 .9 4.8 1.7 4.3 2.3 3.8 3.1 3 3.4 2.3 3.8 1.6 4.3 .9 4.3 0 4.8-.8 4.8-1.4 4.3-2.3 4.3-3.2 4.3-3.4 3.3-4.3 3.1-7.2 3.5-7.6 1.7-7.2 .1-9.6-1.6-3.3-1-2.9-1.7-8.8-8.9-6-4.7-3.3-.5-7.7 1.1-4.8-.1-4.7-1.2-1.9-1.2-1-1-.5-1.5 .4-1.4 1.1-1.3 1.9-1.3 4.7-1.5 7.7-.6 1.1-.5 .7-1 0-1.4-2.8-7.2-1.2-5.3-.1-4.3 .4-1.4 .9-1.2 1.9-.2 2 1 2.2 2.3 2.2 3.4 3.2 7.6 1.9 9.7 .5-.1 1.1-7.2 1.8-4.8 3.2-5.2 3.9-4.3 4.9-3.9 5.6-2.9 5.8-1.9z\" fill=\"var(--bt-ink-deepseek)\"></path><path d=\"M93.3 55.8l1-.3 .1 1.2-2.4 5.3-3.4 4.8-3.8 3.8-4.8 3.4-5.7 2.8-4.8 1.5-4.8 .4 20.1-17.4 5.2-3.7z\" fill=\"#fff\" fill-opacity=\"1\"></path><path d=\"M88.6 29.5l2.4 2.9 1.9 2.8 2.4 6.3 .5 3.3 .1 5.3-1.5 6.6-1.9 4.3-2 3.3-4.8 5.4-5.7 4.3-7.2 3.3-6.2 1.5-6.7 .1-3.3-.2-9.6-1.8-3.3-1.5-2.4-1.9-8.6-8.9-5.3-3.9-3.3-.1-2.9 .2-3.3 .8-5.8 0-4.3-1-2.9-1.9 .6-.6 3.8-1.3 10.5-2.5 4.3 .9 1.4-.1 2.2-1.7 .5-1.4-.3-1.5-1.2-1.4-2.2-1.4-1.2-1.9-.6-12 .4-3.3 .5-.5 2.9 3.8 2.4 4.8 1.9 5.7 .7 5.8 .7 2.8 2.1 2.4 2.7 5.5 3.8 4.3 2.9 2.2 3.3 1 3.4-.4 6.2-3 7.1-4.5 7.3-5.6 6.6-5.9 5.9-6.5 3.7-5.3 1.7-4.2 .1-2.9z\" fill=\"#000\" fill-opacity=\".07\"></path></g></g></g></svg>"
    const WHALE_COLORS = ['#4d6bfe', '#25c2c2', '#ff5c8a', '#3fbf76', '#f4a62a']
    const whaleMarkup = (color, i) => WHALE_SVG
      .replaceAll('bt-mark-1', `bt-whale-${i}`)
      .replace('var(--bt-ink-deepseek)', color)

    function pickBootIdea() {
      let forced = Number(new URLSearchParams(window.location.search).get('boot'))
      try { const saved = Number(window.localStorage.getItem('dsbot-hub:force-boot')); if (Number.isInteger(saved) && saved >= 1 && saved <= 5) forced = saved } catch {}
      if (Number.isInteger(forced) && forced >= 1 && forced <= 5) return forced
      let last = 0
      try { last = Number(window.localStorage.getItem('dsbot-hub:last-boot') || 0) } catch {}
      const pool = [1, 2, 3, 4, 5].filter(n => n !== last)
      const idea = pool[Math.floor(Math.random() * pool.length)]
      try { window.localStorage.setItem('dsbot-hub:last-boot', String(idea)) } catch {}
      return idea
    }

    const bootClamp = (v, a, b) => Math.max(a, Math.min(b, v))
    const bootLerp = (a, b, t) => a + (b - a) * t
    const bootEaseOut = t => 1 - Math.pow(1 - bootClamp(t, 0, 1), 3)
    const bootSmooth = (a, b, t) => { const x = bootClamp((t - a) / (b - a), 0, 1); return x * x * (3 - 2 * x) }

    function drawBootScene(scene, idea, t) {
      if (!scene) return
      const { whales, drops, rings, spark } = scene
      const setW = (i, x, y, rot, scale, op, z) => {
        const el = whales[i]; if (!el) return
        el.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px) rotate(${rot}deg) scale(${scale})`
        el.style.opacity = op
        el.style.zIndex = z || 1
      }
      const drop = (i, x, y, op, size) => {
        const el = drops[i % drops.length]; if (!el) return
        el.style.left = `${x - 1.5}px`; el.style.top = `${y - 1.5}px`
        el.style.opacity = op; el.style.width = el.style.height = `${size || 3}px`
      }
      const clear = () => {
        drops.forEach(d => { d.style.opacity = 0 })
        rings.forEach(r => { r.style.opacity = 0 })
        spark.style.opacity = 0
      }
      clear()
      const TAU = Math.PI * 2
      if (idea === 1) {
        const p = bootEaseOut(t / 0.9)
        setW(0, 0, 95 * (1 - p), -22 * (1 - p), .82 + .18 * p, p, 6)
        for (let i = 1; i < 5; i++) {
          const st = [[-235, 20], [235, 10], [-190, 72], [190, 62]][i - 1]
          const q = bootEaseOut((t - (.10 + i * .07)) / .72)
          const a = i * TAU / 5 - Math.PI / 2
          setW(i, bootLerp(st[0], Math.cos(a) * 112, q), bootLerp(st[1], Math.sin(a) * 48, q), bootLerp(-14, 0, q), .74 + .12 * q, q, i)
        }
        if (t > .95) {
          const u = t - .95
          for (let i = 1; i < 5; i++) {
            const a = i * TAU / 5 - Math.PI / 2 + u * .42
            const dep = (Math.sin(a) + 1) / 2
            setW(i, Math.cos(a) * 112, Math.sin(a) * 48, 0, .76 + .10 * dep, .70 + .30 * dep, 1 + Math.round(dep * 4))
          }
          setW(0, 0, Math.sin(t * 2.1) * 2, 0, 1.12, 1, 6)
        }
        for (let i = 0; i < 12; i++) {
          const a = i / 12 * TAU, r = 18 + 62 * bootEaseOut(t / .8)
          drop(i, 195 + Math.cos(a) * r, 118 + 34 - Math.sin(a) * r * .55, bootClamp(1 - t / 1.15, 0, 1) * .8, 3)
        }
      } else if (idea === 2) {
        const xs = [-126, -63, 0, 63, 126]
        for (let i = 0; i < 5; i++) {
          const local = ((t - i * .18) % 2.6 + 2.6) % 2.6
          const q = local < 1 ? local : -1
          const leap = q >= 0 ? Math.sin(Math.PI * q) : 0
          setW(i, xs[i], 55 - 82 * leap, q >= 0 ? -18 * Math.cos(Math.PI * q) : 0, .70 + .16 * leap, .9 + .1 * leap, 2 + Math.round(leap * 3))
          if (q >= 0 && local < .16) { drop(i, 195 + xs[i], 68, 1, 3); drop(i + 7, 195 + xs[i] + 12, 60, .7, 2) }
        }
      } else if (idea === 3) {
        const cycle = 3.0, u = t % cycle
        for (let i = 0; i < 5; i++) {
          const a = i * TAU / 5 - Math.PI / 2
          const bx = Math.cos(a) * 112, by = Math.sin(a) * 45
          const dive = bootSmooth(.08, .78, u)
          let y = by, sc = 1, op = 1
          if (u < .82) { y = by + 72 * dive; sc = 1 - .32 * dive; op = 1 - dive }
          else if (u < 1.45) { y = by + 72; sc = .68; op = 0 }
          else {
            const q = bootSmooth(1.45 + i * .05, 2.45 + i * .05, u)
            y = by + (1 - q) * 72; sc = .68 + .32 * q; op = q
          }
          setW(i, bx, y, 0, sc * (i === 0 ? 1.1 : 1), op, 1 + Math.round(op * 4))
        }
        for (let i = 0; i < 14; i++) {
          const bx = 20 + ((i * 47) % 350), by = 230 - ((u * 55 + i * 19) % 210)
          drop(i, bx, by, bootClamp(1 - u / 2.6, 0, 1) * .65, 2 + (i % 3))
        }
      } else if (idea === 4) {
        for (let i = 0; i < 5; i++) {
          const a = t * .62 + i * TAU / 5 - Math.PI / 2
          const r = 92 + 25 * Math.sin(t * .95 + i * .7)
          const dep = (Math.sin(a) + 1) / 2
          setW(i, Math.cos(a) * r, Math.sin(a) * r * .48, 0, .72 + .18 * dep, .62 + .38 * dep, 1 + Math.round(dep * 4))
        }
        rings.forEach((r, i) => { r.style.opacity = .7; r.style.transform = `rotate(${t * (i ? -11 : 8)}deg) scale(${1 + i * .18})` })
        for (let i = 0; i < 11; i++) { const a = i / 11 * TAU + t * .2; drop(i, 195 + Math.cos(a) * (150 + i * 3), 118 + 18 + Math.sin(a) * 65, bootClamp(.6 - t / 8, .1, .6), 2) }
      } else {
        const xs = [-125, -62, 0, 62, 125], period = 3.0, u = t % period
        for (let i = 0; i < 5; i++) {
          const local = (u - i * .2 + period) % period
          const f = local < .36 ? Math.sin(Math.PI * local / .36) : 0
          setW(i, xs[i], 48 + Math.abs(i - 2) * 4 - f * 15, (i % 2 ? 1 : -1) * 32 * f, .70 + .18 * f, .86 + .14 * f, 2 + Math.round(f * 4))
        }
        const head = bootClamp(u / period, 0, 1), hx = bootLerp(-145, 145, head)
        spark.style.opacity = 1; spark.style.left = `${195 + hx - 3}px`; spark.style.top = '69px'
      }
    }

    // The same choreography drawBootScene writes to the DOM, returned as values.
    // Sampling this into CSS keyframes moves the boot scene onto the compositor,
    // so it keeps animating while the panel iframe blocks the main thread.
    function scenePoses(idea, t) {
      const out = Array.from({ length: 5 }, () => ({ x: 0, y: 0, rot: 0, scale: 1, op: 0 }))
      const TAU = Math.PI * 2
      if (idea === 1) {
        const p = bootEaseOut(t / 0.9)
        Object.assign(out[0], { x: 0, y: 95 * (1 - p), rot: -22 * (1 - p), scale: .82 + .18 * p, op: p })
        for (let i = 1; i < 5; i++) {
          const st = [[-235, 20], [235, 10], [-190, 72], [190, 62]][i - 1]
          const q = bootEaseOut((t - (.10 + i * .07)) / .72)
          const a = i * TAU / 5 - Math.PI / 2
          Object.assign(out[i], { x: bootLerp(st[0], Math.cos(a) * 112, q), y: bootLerp(st[1], Math.sin(a) * 48, q), rot: bootLerp(-14, 0, q), scale: .74 + .12 * q, op: q })
        }
        if (t > .95) {
          const u = t - .95
          for (let i = 1; i < 5; i++) {
            const a = i * TAU / 5 - Math.PI / 2 + u * .42
            const dep = (Math.sin(a) + 1) / 2
            Object.assign(out[i], { x: Math.cos(a) * 112, y: Math.sin(a) * 48, rot: 0, scale: .76 + .10 * dep, op: .70 + .30 * dep })
          }
          Object.assign(out[0], { x: 0, y: Math.sin(t * 2.1) * 2, rot: 0, scale: 1.12, op: 1 })
        }
      } else if (idea === 2) {
        const xs = [-126, -63, 0, 63, 126]
        for (let i = 0; i < 5; i++) {
          const local = ((t - i * .18) % 2.6 + 2.6) % 2.6
          const q = local < 1 ? local : -1
          const leap = q >= 0 ? Math.sin(Math.PI * q) : 0
          Object.assign(out[i], { x: xs[i], y: 55 - 82 * leap, rot: q >= 0 ? -18 * Math.cos(Math.PI * q) : 0, scale: .70 + .16 * leap, op: .9 + .1 * leap })
        }
      } else if (idea === 3) {
        const u = t % 3.0
        for (let i = 0; i < 5; i++) {
          const a = i * TAU / 5 - Math.PI / 2
          const bx = Math.cos(a) * 112, by = Math.sin(a) * 45
          const dive = bootSmooth(.08, .78, u)
          let y = by, sc = 1, op = 1
          if (u < .82) { y = by + 72 * dive; sc = 1 - .32 * dive; op = 1 - dive }
          else if (u < 1.45) { y = by + 72; sc = .68; op = 0 }
          else {
            const q = bootSmooth(1.45 + i * .05, 2.45 + i * .05, u)
            y = by + (1 - q) * 72; sc = .68 + .32 * q; op = q
          }
          Object.assign(out[i], { x: bx, y, rot: 0, scale: sc * (i === 0 ? 1.1 : 1), op })
        }
      } else if (idea === 4) {
        for (let i = 0; i < 5; i++) {
          const a = t * .62 + i * TAU / 5 - Math.PI / 2
          const r = 92 + 25 * Math.sin(t * .95 + i * .7)
          const dep = (Math.sin(a) + 1) / 2
          Object.assign(out[i], { x: Math.cos(a) * r, y: Math.sin(a) * r * .48, rot: 0, scale: .72 + .18 * dep, op: .62 + .38 * dep })
        }
      } else {
        const xs = [-125, -62, 0, 62, 125], u = t % 3.0
        for (let i = 0; i < 5; i++) {
          const local = (u - i * .2 + 3.0) % 3.0
          const f = local < .36 ? Math.sin(Math.PI * local / .36) : 0
          Object.assign(out[i], { x: xs[i], y: 48 + Math.abs(i - 2) * 4 - f * 15, rot: (i % 2 ? 1 : -1) * 32 * f, scale: .70 + .18 * f, op: .86 + .14 * f })
        }
      }
      return out
    }

    // Poses sampled at 20 Hz per whale; linear interpolation between them is
    // indistinguishable from the rAF version. Ideas 2, 3 and 5 are exactly
    // periodic, so they play whole cycles and loop forever — a slow iframe can
    // never leave them frozen. Ideas 1 and 4 are not periodic (a one-shot
    // entrance, and orbit vs breathing periods that never realign), so they
    // play once and hold.
    const BOOT_SCENE_PLAN = {
      2: { dur: 10.4, loop: true },
      3: { dur: 9, loop: true },
      5: { dur: 9, loop: true },
    }

    function buildBootSceneCSS(idea) {
      const { dur, loop } = BOOT_SCENE_PLAN[idea] ?? { dur: 8, loop: false }
      const STEPS = Math.round(dur * 20)
      let css = `.dbh-boot-scene[data-idea="${idea}"] .dbh-scene-whale{animation-play-state:paused}`
      css += `.dbh-boot-scene[data-idea="${idea}"].live .dbh-scene-whale{animation-play-state:running}`
      for (let w = 0; w < 5; w++) {
        let frames = ''
        for (let k = 0; k <= STEPS; k++) {
          const p = scenePoses(idea, (k / STEPS) * dur)[w]
          const pct = (k / STEPS * 100).toFixed(3)
          frames += `${pct}%{transform:translate(calc(-50% + ${p.x.toFixed(1)}px),calc(-50% + ${p.y.toFixed(1)}px)) rotate(${p.rot.toFixed(1)}deg) scale(${p.scale.toFixed(3)});opacity:${p.op.toFixed(3)}}`
        }
        css += `@keyframes dbh-idea${idea}-w${w}{${frames}}`
        css += `.dbh-boot-scene[data-idea="${idea}"] .dbh-scene-whale[data-w="${w}"]{animation:dbh-idea${idea}-w${w} ${dur}s linear ${loop ? 'infinite' : 'both'};z-index:${6 - w}}`
      }
      css += `@keyframes dbh-boot-drop{0%{transform:translateY(0);opacity:0}12%{opacity:.75}100%{transform:translateY(-52px);opacity:0}}`
      for (let d = 0; d < 18; d++) {
        css += `.dbh-boot-scene[data-idea="${idea}"] .dbh-scene-drop[data-d="${d}"]{left:${(10 + (d * 37) % 360).toFixed(0)}px;top:${(150 + (d * 23) % 95).toFixed(0)}px;animation:dbh-boot-drop ${(2.2 + (d % 5) * .25).toFixed(2)}s linear ${(-(d * .19) % 2.4).toFixed(2)}s infinite}`
      }
      if (idea === 4) {
        css += `@keyframes dbh-boot-ring{from{transform:rotate(0)}to{transform:rotate(360deg)}}`
        css += `.dbh-boot-scene[data-idea="4"] .dbh-scene-ring{opacity:.7;animation:dbh-boot-ring 40s linear infinite}`
        css += `.dbh-boot-scene[data-idea="4"] .dbh-scene-ring:nth-child(2){animation-duration:33s;animation-direction:reverse}`
      }
      if (idea === 5) {
        css += `@keyframes dbh-boot-spark{from{transform:translateX(-145px)}to{transform:translateX(145px)}}`
        css += `.dbh-boot-scene[data-idea="5"] .dbh-scene-spark{opacity:1;animation:dbh-boot-spark 3s linear infinite}`
      }
      return css
    }

    function WhaleScene({ active }) {
      const wrapRef = useRef(null)
      const sceneRef = useRef(null)
      const [idea] = useState(pickBootIdea)

      useEffect(() => {
        const wrap = wrapRef.current
        if (!wrap) return undefined
        const scene = document.createElement('div')
        scene.className = 'dbh-boot-scene'
        scene.dataset.idea = String(idea)
        scene.setAttribute('aria-hidden', 'true')
        scene.innerHTML = `
          <div class="dbh-scene-ring"></div><div class="dbh-scene-ring"></div>
          ${WHALE_COLORS.map((color, i) => `<div class="dbh-scene-whale" data-w="${i}"><div class="dbh-scene-whale-art">${whaleMarkup(color, i)}</div></div>`).join('')}
          ${Array.from({ length: 18 }, (_, i) => `<div class="dbh-scene-drop" data-d="${i}"></div>`).join('')}
          <div class="dbh-scene-spark"></div>`
        wrap.appendChild(scene)
        const state = {
          el: scene,
          whales: [...scene.querySelectorAll('.dbh-scene-whale')],
          drops: [...scene.querySelectorAll('.dbh-scene-drop')],
          rings: [...scene.querySelectorAll('.dbh-scene-ring')],
          spark: scene.querySelector('.dbh-scene-spark'),
        }
        sceneRef.current = state
        const update = () => {
          const s = Math.min(wrap.clientWidth / 390, wrap.clientHeight / 260)
          scene.style.transform = `translate(-50%,-50%) scale(${s})`
        }
        update()
        const ro = new ResizeObserver(update)
        ro.observe(wrap)
        return () => { ro.disconnect(); scene.remove(); sceneRef.current = null }
      }, [idea])

      useEffect(() => {
        const scene = sceneRef.current
        if (scene === null) return undefined
        const el = scene.el
        if (el === null || el === undefined) return undefined
        el.dataset.idea = String(idea)
        // Reduced motion keeps the static frame: CSS animations outrank inline
        // styles, so the sheet must not be injected at all in that case.
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          drawBootScene(scene, idea, .9)
          return undefined
        }
        const id = `dbh-boot-css-${idea}`
        if (!document.getElementById(id)) {
          const style = document.createElement('style')
          style.id = id
          style.textContent = buildBootSceneCSS(idea)
          document.head.appendChild(style)
        }
        return undefined
      }, [idea])

      useEffect(() => {
        const scene = sceneRef.current
        if (scene === null || scene.el === null || scene.el === undefined) return undefined
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        scene.el.classList.toggle('live', active && !reduced)
      }, [active, idea])

      return h('div', { className: 'dbh-boot-pod', ref: wrapRef })
    }

    const BACK_STACK = []
    let BACK_READY = false
    function ensureBackListener() {
      if (BACK_READY) return
      BACK_READY = true
      if (window.navigation?.addEventListener) {
        window.navigation.addEventListener('navigate', event => {
          if (event.navigationType !== 'traverse' || BACK_STACK.length === 0) return
          event.preventDefault()
          const layer = BACK_STACK.pop()
          if (layer) layer.onBack()
        })
      } else {
        window.addEventListener('popstate', () => {
          if (BACK_STACK.length === 0) return
          const layer = BACK_STACK.pop()
          if (layer) layer.onBack()
        })
      }
    }
    function pushBackLayer(layer) {
      ensureBackListener()
      if (BACK_STACK.some(entry => entry.id === layer.id)) return
      BACK_STACK.push(layer)
    }
    function removeBackLayer(id) {
      const index = BACK_STACK.findIndex(entry => entry.id === id)
      if (index < 0) return false
      BACK_STACK.splice(index, 1)
      return true
    }
    function useHubBackLayer(id, active, onBack) {
      const ref = useRef(onBack)
      ref.current = onBack
      useEffect(() => {
        if (!active) return undefined
        pushBackLayer({ id, onBack: () => ref.current() })
        return () => { removeBackLayer(id) }
      }, [active, id])
    }

    function Panel({ toggleSidecard }) {
      const [servers, setServers] = useState([])
      const [selectedId, setSelectedId] = useState('')
      const [sheet, setSheet] = useState(false)
      const [frameNonce, setFrameNonce] = useState(0)
      const [token, setToken] = useState('')
      const [loginBusy, setLoginBusy] = useState(false)
      const [loginError, setLoginError] = useState('')
      const [apiError, setApiError] = useState('')
      const [loaded, setLoaded] = useState(false)
      const [settingsOpen, setSettingsOpen] = useState(false)
      const [mobileView, setMobileView] = useState('chat')
      const [isMobile, setIsMobile] = useState(false)
      const [frameReady, setFrameReady] = useState(false)
      const [frameLoaded, setFrameLoaded] = useState(false)
      const shellMobile = useShellMobile()
      const mounted = useRef(true)
      const chipRef = useRef(null)
      const popRef = useRef(null)
      const sheetRef = useRef(null)
      const gearRef = useRef(null)
      const frameRef = useRef(null)

      const selected = useMemo(() => servers.find(server => server.id === selectedId) ?? servers[0], [servers, selectedId])
      const status = selected?.status ?? 'checking'

      useHubBackLayer('hub-servers', sheet, () => setSheet(false))
            useHubBackLayer('hub-mobile', isMobile && !shellMobile && mobileView !== 'chat', () => setMobileView('chat'))

      useEffect(() => {
        let edgeStart = null
        const onStart = event => {
          const touch = event.touches?.[0]
          edgeStart = touch && touch.clientX <= 22 ? { x: touch.clientX, y: touch.clientY } : null
        }
        const onEnd = event => {
          const touch = event.changedTouches?.[0]
          if (!edgeStart || !touch) return
          const dx = touch.clientX - edgeStart.x
          const dy = Math.abs(touch.clientY - edgeStart.y)
          edgeStart = null
          if (dx > 64 && dy < 60 && BACK_STACK.length > 0) BACK_STACK[BACK_STACK.length - 1].onBack()
        }
        window.addEventListener('touchstart', onStart, { passive: true })
        window.addEventListener('touchend', onEnd, { passive: true })
        return () => {
          window.removeEventListener('touchstart', onStart)
          window.removeEventListener('touchend', onEnd)
        }
      }, [])

      useEffect(() => {
        return () => {
          for (const entry of [...BACK_STACK]) {
            if (entry.id.startsWith('frame:')) removeBackLayer(entry.id)
          }
        }
      }, [selected?.id, frameNonce])

      useEffect(() => {
        setFrameReady(false)
        setFrameLoaded(false)
      }, [selected?.id, frameNonce])

      useEffect(() => {
        const onMessage = event => {
          const frame = frameRef.current
          if (frame === null || event.source !== frame.contentWindow) return
          if (event.data?.type === 'dsbot-hub:ready') {
            setFrameReady(true)
            return
          }
          if (event.data?.type !== 'dsbot-hub:layer') return
          const layer = typeof event.data.layer === 'string' ? event.data.layer : ''
          if (layer === '') return
          const id = `frame:${layer}`
          const origin = event.origin
          if (event.data.action === 'open') {
            pushBackLayer({
              id,
              onBack: () => {
                try { event.source?.postMessage({ type: 'dsbot-hub:back', layer }, origin) } catch {}
              },
            })
          } else if (event.data.action === 'close') {
            removeBackLayer(id)
          }
        }
        window.addEventListener('message', onMessage)
        return () => window.removeEventListener('message', onMessage)
      }, [])

      useEffect(() => {
        if (!frameLoaded || frameReady) return undefined
        const timer = window.setTimeout(() => setFrameReady(true), 5000)
        return () => window.clearTimeout(timer)
      }, [frameLoaded, frameReady])

      const refresh = useCallback(async () => {
        try {
          const response = await fetch('/dsbot-hub/api/servers', { cache: 'no-store', credentials: 'same-origin' })
          if (!response.ok) {
            setApiError(response.status === 401 ? 'Open this panel from DSH.' : `Hub API returned ${response.status}.`)
            return
          }
          const body = await response.json()
          if (!mounted.current) return
          setApiError('')
          setServers(Array.isArray(body.servers) ? body.servers : [])
          setLoaded(true)
          setSelectedId(current => {
            if (current !== '' && (body.servers ?? []).some(server => server.id === current)) return current
            let saved = null
            try { saved = window.localStorage.getItem(LAST_SERVER) } catch {}
            if (saved !== null && (body.servers ?? []).some(server => server.id === saved)) return saved
            if (typeof body.defaultServer === 'string' && (body.servers ?? []).some(server => server.id === body.defaultServer)) return body.defaultServer
            return body.servers?.[0]?.id ?? ''
          })
        } catch (error) {
          if (mounted.current) setApiError(`Hub API unreachable: ${error?.message ?? error}`)
        }
      }, [])

      useEffect(() => {
        mounted.current = true
        void refresh()
        const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh() }, 3000)
        const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
        document.addEventListener('visibilitychange', onVisible)
        window.addEventListener('online', onVisible)
        return () => {
          mounted.current = false
          window.clearInterval(timer)
          document.removeEventListener('visibilitychange', onVisible)
          window.removeEventListener('online', onVisible)
        }
      }, [refresh])

      useEffect(() => {
        if (selectedId !== '') { try { window.localStorage.setItem(LAST_SERVER, selectedId) } catch {} }
      }, [selectedId])

      useEffect(() => {
        if (!sheet) return undefined
        const frame = window.requestAnimationFrame(() => {
          const surface = [popRef.current, sheetRef.current].find(element => element?.getClientRects().length > 0)
          const first = surface?.querySelector('button')
          ;(first ?? chipRef.current)?.focus?.()
        })
        const onKey = event => {
          if (event.key === 'Escape') {
            setSheet(false)
            chipRef.current?.focus?.()
          }
        }
        document.addEventListener('keydown', onKey)
        return () => {
          window.cancelAnimationFrame(frame)
          document.removeEventListener('keydown', onKey)
        }
      }, [sheet])

      useEffect(() => {
        const mq = window.matchMedia('(max-width: 700px)')
        const sync = () => setIsMobile(mq.matches)
        sync()
        mq.addEventListener?.('change', sync)
        return () => mq.removeEventListener?.('change', sync)
      }, [])

      const frameSrc = selected !== undefined && status === 'ok'
        ? `/dsbot-hub/api/servers/${encodeURIComponent(selected.id)}/open?n=${frameNonce}`
        : ''

      const reload = useCallback(() => {
        setFrameNonce(value => value + 1)
        void refresh()
      }, [refresh])

      const login = useCallback(async () => {
        if (selected === undefined || token.trim() === '') return
        setLoginBusy(true)
        setLoginError('')
        try {
          const response = await fetch(`/dsbot-hub/api/servers/${encodeURIComponent(selected.id)}/login`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ token: token.trim() }),
          })
          const body = await response.json().catch(() => ({}))
          if (!response.ok || body.ok !== true) {
            setLoginError(typeof body.error === 'string' ? body.error : 'Sign-in failed.')
            return
          }
          setToken('')
          await refresh()
        } catch (error) {
          setLoginError(String(error?.message ?? error))
        } finally {
          if (mounted.current) setLoginBusy(false)
        }
      }, [selected, token, refresh])

      const choose = useCallback(serverId => {
        // Picking the server already shown is a no-op: it must not re-key the
        // frame or reload the remote app, which would start a fresh view over
        // the retained conversation.
        setSheet(false)
        chipRef.current?.focus?.()
        if (serverId === selected?.id) return
        setSelectedId(serverId)
        setFrameNonce(value => value + 1)
        setLoginError('')
        setToken('')
      }, [selected?.id])

      const serverRows = servers.map(server => h('button', {
        key: server.id,
        type: 'button',
        className: `dbh-srvrow${server.id === selected?.id ? ' active' : ''}`,
        onClick: () => choose(server.id),
        'aria-current': server.id === selected?.id ? 'true' : undefined,
      },
      h('span', { className: `dbh-dot ${statusClass(server)}` }),
      h('span', { className: 'dbh-srvav' }, String(server.label || server.id).trim().charAt(0).toUpperCase()),
      h('span', { className: 'dbh-srvbody' },
        h('span', { className: 'dbh-srvname' }, server.label),
        h('span', { className: `dbh-srvmeta ${liveTone(server)}` }, `${plural(server.counts?.bots ?? 0, 'bot', 'bots')} · ${liveDetail(server)}`)),
      server.id === selected?.id ? h('span', { className: 'dbh-check' }, h(Icon, { name: 'check', size: 15 })) : null))

      const chip = h('button', {
        ref: chipRef,
        type: 'button',
        className: 'dbh-chip',
        onClick: () => setSheet(value => !value),
        'aria-haspopup': 'dialog',
        'aria-expanded': sheet,
        'aria-label': `${selected?.label ?? 'No servers'} — ${compactLive(selected)}`,
        title: 'Switch server',
      },
      h(Icon, { name: 'server', size: 14, className: 'dbh-chipicon' }),
      h('span', { className: `dbh-dot ${statusClass(selected)}` }),
      h('span', { className: 'dbh-label' }, selected?.label ?? 'No servers'),
      selected === undefined ? null : h('span', { className: 'dbh-livechip' }, compactLive(selected)),
      h(Icon, { name: 'chevron', size: 12, className: 'dbh-caret' }))

      const onChanged = () => {
        setFrameNonce(value => value + 1)
        void refresh()
      }
      const settingsOverlay = settingsOpen
        ? h('div', { className: 'dbh-settings-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'DS Bot Hub settings' },
          h(SettingsView, {
            servers,
            layerId: 'hub-settings-overlay',
            onClose: () => {
              setSettingsOpen(false)
              gearRef.current?.focus?.()
            },
            onChanged,
          }))
        : null

      let content
      if (!loaded && apiError === '') {
        content = h('div', { className: 'dbh-center', role: 'status' }, h('span', { className: 'dbh-spinner', 'aria-hidden': 'true' }), 'Checking servers…')
      } else if (apiError !== '' && servers.length === 0) {
        content = h('div', { className: 'dbh-cardwrap' },
          h('div', { className: 'dbh-card' },
            h('div', { className: 'dbh-cardicon' }, h(Icon, { name: 'warning', size: 16 })),
            h('h2', null, 'Hub API unavailable'),
            h('p', null, apiError),
            h('button', { className: 'dbh-btn ghost', onClick: () => void refresh() }, 'Retry')))
      } else if (servers.length === 0) {
        content = h('div', { className: 'dbh-cardwrap' },
          h('div', { className: 'dbh-card' },
            h('div', { className: 'dbh-cardicon' }, h(Icon, { name: 'server', size: 16 })),
            h('h2', null, 'No servers yet'),
            h('p', null, 'Add a DS Bot server to bring its team into the hub.'),
            h('button', { className: 'dbh-btn', onClick: () => setSettingsOpen(true) }, 'Add server')))
      } else if (selected === undefined) {
        content = h('div', { className: 'dbh-center', role: 'status' }, h('span', { className: 'dbh-spinner', 'aria-hidden': 'true' }), 'Choosing a server…')
      } else if (selected.status === 'ok' && frameSrc !== '') {
        content = h('div', { key: `${selected.id}:${frameNonce}`, className: 'dbh-framewrap', 'aria-busy': !frameReady },
          h('iframe', {
            ref: frameRef,
            className: 'dbh-frame',
            title: `${selected.label} — DS Bot`,
            src: frameSrc,
            allow: 'clipboard-read; clipboard-write; fullscreen',
            referrerPolicy: 'no-referrer',
            onLoad: () => setFrameLoaded(true),
          }),
          h('div', {
            className: `dbh-boot${frameReady ? ' out' : ''}`,
            role: 'status',
            'aria-live': 'polite',
            'aria-hidden': frameReady ? 'true' : undefined,
          },
          h(WhaleScene, { active: !frameReady }),
          h('div', { className: 'dbh-boot-title' }, `Waking up ${selected.label}`),
          h('div', { className: 'dbh-boot-sub' }, 'DSBots Hub')))
      } else if (selected.status === 'ok' || selected.status === 'checking') {
        content = h('div', { className: 'dbh-center', role: 'status' }, h('span', { className: 'dbh-spinner', 'aria-hidden': 'true' }), `Loading ${selected.label}…`)
      } else if (selected.status === 'unauthorized') {
        content = h('div', { className: 'dbh-cardwrap' },
          h('div', { className: 'dbh-card' },
            h('div', { className: 'dbh-cardicon' }, h(Icon, { name: 'lock', size: 16 })),
            h('h2', null, `Sign in to ${selected.label}`),
            h('p', null, selected.reason || 'The server needs a fresh login token.'),
            h('div', { className: 'dbh-row' },
              h('input', {
                className: 'dbh-input',
                placeholder: 'Paste login URL or token',
                value: token,
                onChange: event => setToken(event.target.value),
                onKeyDown: event => { if (event.key === 'Enter') void login() },
                autoFocus: true,
              }),
              h('button', { className: 'dbh-btn', onClick: () => void login(), disabled: loginBusy }, loginBusy ? 'Signing in…' : 'Sign in')),
            loginError !== '' ? h('div', { className: 'dbh-err', role: 'alert' }, loginError) : null,
            h('div', { className: 'dbh-hint' }, 'The token is the login URL the ds-bot container prints. It is stored as a DSH secret; the browser never holds the DS Bot cookie.')))
      } else {
        content = h('div', { className: 'dbh-cardwrap' },
          h('div', { className: 'dbh-card' },
            h('div', { className: 'dbh-cardicon' }, h(Icon, { name: 'warning', size: 16 })),
            h('h2', null,
              selected.status === 'unreachable' ? `${selected.label} is unreachable`
                : selected.status === 'incompatible' ? `${selected.label} is incompatible`
                  : selected.status === 'misconfigured' ? `Check the ${selected.label} proxy`
                    : `${selected.label} is not ready`),
            h('p', null, selected.reason || 'The server did not answer the state probe.'),
            h('button', { className: 'dbh-btn ghost', onClick: reload }, 'Retry')))
      }

      let mobileContent = content
      if (shellMobile) {
        // DSH's navigation owns Chat/Servers/Settings; the panel is the DS Bot view.
        mobileContent = content
      } else if (isMobile && mobileView === 'servers') {
        mobileContent = h('div', { className: 'dbh-mobilepage' },
          h('div', { className: 'dbh-mobilehead' },
            h('div', null,
              h('h2', null, 'Servers'),
              h('p', null, 'One server at a time. Switching keeps each server’s thread.'))),
          h('div', { className: 'dbh-mobilelist' }, serverRows),
          h('button', { className: 'dbh-btn dbh-mobileadd', onClick: () => { setSettingsOpen(true); setMobileView('settings') } }, 'Add server'))
      } else if (isMobile && mobileView === 'settings') {
        mobileContent = h(SettingsView, {
          servers,
          layerId: 'hub-settings-mobile',
          onClose: () => setMobileView('chat'),
          onChanged: () => {
            setFrameUrl('')
            setFrameServer('')
            void refresh()
          },
        })
      } else if (isMobile) {
        mobileContent = content
      }

      return h('div', { className: 'dbh-root' },
        h('style', null, CSS),
        h('header', { className: 'dbh-bar' },
          chip,
          h('div', { className: 'dbh-grow' }),
          h('button', {
            className: 'dbh-icon',
            onClick: () => toggleSidecard?.(),
            title: 'Toggle side panel',
            'aria-label': 'Toggle side panel',
          }, h(Icon, { name: 'panelRight', size: 15 })),
          h('button', { className: 'dbh-icon', onClick: reload, title: 'Reload', 'aria-label': 'Reload' }, h(Icon, { name: 'refresh', size: 15 })),
          selected === undefined ? null : h('a', { className: 'dbh-icon', href: `/dsbot-hub/api/servers/${encodeURIComponent(selected.id)}/open`, target: '_blank', rel: 'noreferrer', title: 'Open in tab', 'aria-label': 'Open in tab' }, h(Icon, { name: 'external', size: 15 })),
          h('button', {
            ref: gearRef,
            className: `dbh-icon${settingsOpen ? ' on' : ''}`,
            onClick: () => setSettingsOpen(value => !value),
            title: 'Settings',
            'aria-label': 'Settings',
            'aria-pressed': settingsOpen,
          }, h(Icon, { name: 'settings', size: 15 }))),
        h('div', { className: 'dbh-content' }, mobileContent, settingsOverlay),
        isMobile && !shellMobile ? h('nav', { className: 'dbh-mnav', 'aria-label': 'Hub' },
          h('button', { type: 'button', className: `dbh-mnav-btn${mobileView === 'chat' ? ' on' : ''}`, onClick: () => setMobileView('chat') },
            h(Icon, { name: 'chat', size: 20 }), h('span', null, 'Chat')),
          h('button', { type: 'button', className: `dbh-mnav-btn${mobileView === 'servers' ? ' on' : ''}`, onClick: () => setMobileView('servers') },
            h(Icon, { name: 'server', size: 20 }), h('span', null, 'Servers')),
          h('button', { type: 'button', className: `dbh-mnav-btn${mobileView === 'settings' ? ' on' : ''}`, onClick: () => setMobileView('settings') },
            h(Icon, { name: 'settings', size: 20 }), h('span', null, 'Settings'))) : null,
        sheet ? h(React.Fragment, null,
          h('div', { className: 'dbh-popscrim', onClick: () => { setSheet(false); chipRef.current?.focus?.() } }),
          h('div', { className: 'dbh-pop', ref: popRef, role: 'dialog', 'aria-label': 'Servers', onKeyDown: event => trapTab(event, event.currentTarget) },
            h('div', { className: 'dbh-pophead' }, 'Servers'),
            serverRows,
            h('div', { className: 'dbh-popnote' }, 'One server at a time. The bots below are that server’s.')),
          h('div', { className: 'dbh-scrim', onClick: () => { setSheet(false); chipRef.current?.focus?.() } },
            h('div', { className: 'dbh-sheet', ref: sheetRef, onClick: event => event.stopPropagation(), role: 'dialog', 'aria-label': 'Servers', onKeyDown: event => trapTab(event, event.currentTarget) },
              h('div', { className: 'dbh-grab' }),
              h('div', { className: 'dbh-sheethead' }, 'Servers'),
              serverRows,
              h('div', { className: 'dbh-sheetnote' }, 'One server at a time. Switching keeps each server’s own thread.'))))
          : null)
    }

    return {
      inject: ['slots', 'layout'],
      apply(ctx) {
        ctx.effect(() => {
          const style = document.createElement('style')
          style.setAttribute('data-dsbot-hub-nav', '')
          style.textContent = NAV_CSS
          document.head.append(style)
          return () => { style.remove() }
        }, 'dsbot-hub: navigation entry styles')
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_KEY,
          inject: () => ({
            toggleSidecard: () => {
              try { ctx.get('sidebarRight')?.toggleExpanded?.() } catch {}
            },
          }),
        }, Panel))
        // DSH mobile navigation: the DS Bot surface is one destination beside
        // Chat and Settings. The shell owns the bar; this entry owns its glyph,
        // label, active state, and activation.
        ctx.slots.inject('shell.mobile.nav', () => ctx.slots.register({
          name: 'shell.mobile.nav',
          id: 'servers',
          order: 5,
          inject: () => ({ openServers: () => { ctx.layout.selectPanel(PANEL_KEY) } }),
        }, ServersTab))
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_KEY,
          order: 20,
          label: () => 'DS Bot Hub',
        }, ServersIcon))
      },
    }
  },
})

from pathlib import Path
p=Path('/mnt/data/v92next/assets/app.js')
s=p.read_text()
old='''<div class="postbattle-roll-column"><div class="postbattle-bonus-controls"><label class="postbattle-check"><input type="checkbox" ${p.winner?'checked':''} onchange="setPostBattleWinner(this.checked)"><span>Victoire de la dernière bataille <b>+1 dé</b></span></label><label><span>Dés supplémentaires</span><input type="number" min="0" max="20" value="${p.extraDice}" onchange="setPostBattleNumber('extraDice',this.value)"><small>Compétences, équipement ou autre bonus autorisé</small></label></div><div class="postbattle-dice-head">'''
new='''<div class="postbattle-roll-column"><div class="postbattle-dice-head">'''
if old not in s:
    raise SystemExit('old segment not found')
s=s.replace(old,new,1)
old2='''</div></div></div><div class="postbattle-summary">'''
new2='''</div></div><div class="postbattle-bonus-controls"><label class="postbattle-check"><input type="checkbox" ${p.winner?'checked':''} onchange="setPostBattleWinner(this.checked)"><span>Victoire de la dernière bataille <b>+1 dé</b></span></label><label><span>Dés supplémentaires</span><input type="number" min="0" max="20" value="${p.extraDice}" onchange="setPostBattleNumber('extraDice',this.value)"><small>Compétences, équipement ou autre bonus autorisé</small></label></div></div><div class="postbattle-summary">'''
if old2 not in s:
    raise SystemExit('old2 segment not found')
s=s.replace(old2,new2,1)
p.write_text(s)

css=Path('/mnt/data/v92next/assets/styles.css')
c=css.read_text()
c=c.replace('.postbattle-bonus-controls{display:grid;grid-template-columns:minmax(0,1fr) minmax(150px,.8fr);gap:8px;margin-bottom:10px}', '.postbattle-bonus-controls{display:grid;grid-column:1;grid-template-columns:minmax(0,1fr) minmax(150px,.8fr);gap:8px;margin-top:10px;align-self:start}')
c=c.replace('.postbattle-income-layout .postbattle-hero-validation{height:100%}', '.postbattle-income-layout .postbattle-hero-validation{height:100%}.postbattle-income-layout .postbattle-roll-column{grid-column:2;grid-row:1 / span 2}.postbattle-income-layout .postbattle-bonus-controls{grid-column:1;grid-row:2}')
c=c.replace('@media(max-width:900px){.postbattle-income-layout{grid-template-columns:1fr}.postbattle-bonus-controls{grid-template-columns:1fr}', '@media(max-width:900px){.postbattle-income-layout{grid-template-columns:1fr}.postbattle-income-layout .postbattle-roll-column,.postbattle-income-layout .postbattle-bonus-controls{grid-column:1;grid-row:auto}.postbattle-bonus-controls{grid-template-columns:1fr}')
css.write_text(c)

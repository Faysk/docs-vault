const fs=require('fs'),vm=require('vm'),assert=require('assert');
process.env.TZ='Europe/London';
const source=fs.readFileSync('assets/js/app.js','utf8');
const helpers=source.slice(source.indexOf('  const today0='),source.indexOf('  const fmtDateTime='));
const RealDate=Date;class Clock extends RealDate{constructor(...args){super(...(args.length?args:['2026-10-24T12:00:00+01:00']))}}
const c={Date:Clock,Intl};vm.createContext(c);vm.runInContext(helpers+';globalThis.check={parseDate,daysTo,fmtDate};',c);
assert.equal(c.check.daysTo('2026-10-24'),0);assert.equal(c.check.daysTo('2026-10-26'),2);assert.equal(c.check.daysTo('2026-10-23'),-1);assert.equal(c.check.parseDate('2026-02-30'),null);assert.equal(c.check.daysTo('invalid'),null);
console.log('Vault: calendar dates, DST boundary and invalid dates passed.');

import * as adhan from 'adhan';

// --- EXACT config mirrored from czas-modlitwy-standalone.html (khutba.alislam.pl) ---
const CONFIG = {
  fajrOffsetMinutes: 90,            // Fadżr/Suḥūr: 1h30 before sunrise
  ishaAngle: 17,                    // Isza angle
  highLatitudeRule: 'seventhofthenight',
  madhab: 'shafi',                  // Asr 1x shadow
};

const CITY = { label: 'Warszawa', lat: 52.2297, lon: 21.0122, tz: 'Europe/Warsaw' };

function calcParams() {
  const params = adhan.CalculationMethod.MuslimWorldLeague();
  params.ishaAngle = CONFIG.ishaAngle;
  params.madhab = CONFIG.madhab === 'hanafi' ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;
  params.highLatitudeRule = adhan.HighLatitudeRule.SeventhOfTheNight;
  return params;
}

function cityYMD(tz, offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(d).reduce((a, x) => (a[x.type] = x.value, a), {});
  return { y: +p.year, m: +p.month, d: +p.day };
}

function fmt(date, tz) {
  return new Intl.DateTimeFormat('pl-PL', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

const offset = Number(process.argv[2] || 0);
const { y, m, d } = cityYMD(CITY.tz, offset);
const coords = new adhan.Coordinates(CITY.lat, CITY.lon);
const pt = new adhan.PrayerTimes(coords, new Date(y, m - 1, d, 12), calcParams());
const fajr = new Date(pt.sunrise.getTime() - CONFIG.fajrOffsetMinutes * 60000);

const dateStr = new Intl.DateTimeFormat('pl-PL', { timeZone: CITY.tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  .format(new Date(y, m - 1, d, 12));

const out = {
  city: CITY.label,
  date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
  dateLabel: dateStr,
  times: {
    'Fadżr / Suḥūr': fmt(fajr, CITY.tz),
    'Wschód słońca': fmt(pt.sunrise, CITY.tz),
    'Zuhr': fmt(pt.dhuhr, CITY.tz),
    'Asar': fmt(pt.asr, CITY.tz),
    'Maghrib / Ifṭār': fmt(pt.maghrib, CITY.tz),
    'Isza': fmt(pt.isha, CITY.tz),
  },
};
console.log(JSON.stringify(out, null, 2));

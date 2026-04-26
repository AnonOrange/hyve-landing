/* Hyve v2 — Part 2: NAT database + app logic */

/* n(id, icon, label, subtitle, cat, req, smartTpl, baseFallback) */
const n=(id,ic,lb,sb,ct,rq,sm,bs)=>({id,ic,lb,sb,ct,rq,sm,bs:bs||sm||null});

const NAT=[
/* ── COURTS ───────────────────────────────────────────── */
n('cl','⚖️','CourtListener','Federal & state case law','courts','name',
  'https://www.courtlistener.com/?q={name}&type=r','https://www.courtlistener.com/'),
n('pacer','⚖️','PACER Federal Courts','Federal dockets & filings','courts',null,null,
  'https://pacer.uscourts.gov/'),
n('justia','⚖️','Justia Dockets','Federal court dockets','courts','name',
  'https://dockets.justia.com/search?query={name}','https://dockets.justia.com/'),
n('unicourt','⚖️','UniCourt','Civil & criminal dockets','courts','name',
  'https://unicourt.com/search/parties?q={name}','https://unicourt.com/'),

/* ── CORRECTIONS ──────────────────────────────────────── */
n('bop','🔒','BOP Federal Inmate Locator','Federal prison records','doc','name',
  'https://www.bop.gov/inmateloc/','https://www.bop.gov/inmateloc/'),
n('vine','🔒','VINELink','Custody status & notifications','doc',null,null,
  'https://vinelink.com/'),

/* ── SEX OFFENDER ─────────────────────────────────────── */
n('nsopw','🚨','NSOPW National Registry','National sex offender search','sor','name',
  'https://www.nsopw.gov/search/results?term={name}&searchType=name','https://www.nsopw.gov/'),
n('familywatchdog','🚨','Family Watchdog','Map-based SOR search','sor',null,null,
  'https://www.familywatchdog.us/'),

/* ── STATE RECORDS (national tools) ──────────────────── */
n('opencorp','📂','OpenCorporates','Global business registry','state','name',
  'https://opencorporates.com/companies?q={name}&jurisdiction_code=us','https://opencorporates.com/'),
n('bbb','📂','BBB Business Search','Better Business Bureau','state','name',
  'https://www.bbb.org/search?find_text={name}','https://www.bbb.org/'),
n('zillow','📂','Zillow','Property & address lookup','state','address',
  'https://www.zillow.com/homes/{address}_rb/','https://www.zillow.com/'),
n('redfin','📂','Redfin','Property records','state',null,null,
  'https://www.redfin.com/'),
n('vote411','📂','VOTE411 Voter Guide','Voter registration check','state',null,null,
  'https://www.vote411.org/'),
n('blackbookonline','📂','Black Book Online','Free public records dir.','state',null,null,
  'https://www.blackbookonline.info/'),
n('searchsystems','📂','Search Systems','Public records by location','state',null,null,
  'https://publicrecords.searchsystems.net/'),

/* ── PEOPLE SEARCH ────────────────────────────────────── */
n('tps','👥','TruePeopleSearch','Name/phone/address lookup','people','name',
  'https://www.truepeoplesearch.com/results?name={name}','https://www.truepeoplesearch.com/'),
n('fps','👥','FastPeopleSearch','Free people search','people','name',
  'https://www.fastpeoplesearch.com/name/{name_dashed}','https://www.fastpeoplesearch.com/'),
n('spokeo','👥','Spokeo','People aggregator','people','name',
  'https://www.spokeo.com/{name_dashed}','https://www.spokeo.com/'),
n('whitepages','👥','WhitePages','People & address search','people','name',
  'https://www.whitepages.com/name/{name_dashed}','https://www.whitepages.com/'),
n('411','👥','411.com','People directory','people','name',
  'https://www.411.com/name/{name_dashed}','https://www.411.com/'),
n('intelius','👥','Intelius','Background reports','people',null,null,
  'https://www.intelius.com/'),
n('peoplefinders','👥','PeopleFinders','People search','people','name',
  'https://www.peoplefinders.com/people/{name_dashed}','https://www.peoplefinders.com/'),
n('usphonebook','👥','USPhoneBook','Name/phone/address','people','name',
  'https://www.usphonebook.com/{name_dashed}','https://www.usphonebook.com/'),
n('beenverified','👥','BeenVerified','Background check','people',null,null,
  'https://www.beenverified.com/'),
n('radaris','👥','Radaris','People & business search','people','name',
  'https://radaris.com/p/{first}/{last}/','https://radaris.com/'),
n('familytreenow','👥','FamilyTreeNow','Free people search','people','name',
  'https://www.familytreenow.com/search/people/results?first={first}&last={last}','https://www.familytreenow.com/'),
n('zabasearch','👥','ZabaSearch','Name/address lookup','people','name',
  'https://www.zabasearch.com/people/{first}+{last}/','https://www.zabasearch.com/'),
n('spf','👥','SearchPeopleFree','Free people search','people','name',
  'https://www.searchpeoplefree.com/find/{first}-{last}','https://www.searchpeoplefree.com/'),
n('checkpeople','👥','CheckPeople','Background search','people',null,null,
  'https://checkpeople.com/'),
n('truthfinder','👥','TruthFinder','People search','people',null,null,
  'https://www.truthfinder.com/'),
n('ussearch','👥','US Search','People & background','people',null,null,
  'https://www.ussearch.com/'),
n('cocofinder','👥','CocoFinder','Free people finder','people','name',
  'https://cocofinder.com/people?name={name}','https://cocofinder.com/people'),
n('smartbg','👥','SmartBackground Checks','Free background search','people','name',
  'https://www.smartbackgroundchecks.com/lookup/{name_dashed}','https://www.smartbackgroundchecks.com/'),
n('addressrpt','👥','Address Report','Address-based lookup','people','address',
  'https://www.addressreport.com/address/{address}','https://www.addressreport.com/'),
n('pipl','👥','Pipl (Manual)','Deep web people search','people',null,null,
  'https://pipl.com/'),
n('cyberbg','👥','CyberBackgroundChecks','Free records search','people','name',
  'https://www.cyberbackgroundchecks.com/people/{first}/{last}','https://www.cyberbackgroundchecks.com/'),

/* ── PHONE ────────────────────────────────────────────── */
n('wp-phone','📞','WhitePages Phone','Reverse phone lookup','phone','phone',
  'https://www.whitepages.com/phone/{phone_raw}','https://www.whitepages.com/reverse-phone/'),
n('numlookup','📞','NumLookup','Free reverse phone','phone','phone',
  'https://www.numlookup.com/{phone_raw}','https://www.numlookup.com/'),
n('spydialer','📞','SpyDialer','Phone, name, address','phone','phone',
  'https://www.spydialer.com/default.aspx?Phone={phone_raw}','https://www.spydialer.com/'),
n('truecaller','📞','Truecaller','Caller ID & spam','phone','phone',
  'https://www.truecaller.com/search/us/{phone_raw}','https://www.truecaller.com/'),
n('reverse','📞','Reverse.com','Reverse phone & address','phone','phone',
  'https://www.reverse.com/reverse-phone/?number={phone_raw}','https://www.reverse.com/'),
n('usphonebook-ph','📞','USPhoneBook (Phone)','Reverse phone lookup','phone','phone',
  'https://www.usphonebook.com/{phone_raw}','https://www.usphonebook.com/'),
n('whocalledme','📞','WhoCalledMe','Caller ID community','phone','phone',
  'https://www.whocalledme.com/Number/{phone_raw}','https://www.whocalledme.com/'),
n('anywho','📞','AnyWho','Reverse phone & people','phone','phone',
  'https://www.anywho.com/reverse-lookup/{phone_raw}','https://www.anywho.com/'),
n('800notes','📞','800Notes','Phone complaint lookup','phone','phone',
  'https://800notes.com/Phone.aspx/{phone_raw}','https://800notes.com/'),
n('okcaller','📞','OkCaller','Free caller ID lookup','phone','phone',
  'https://www.okcaller.com/{phone_raw}','https://www.okcaller.com/'),
n('callersmart','📞','CallerSmart','Phone spam reports','phone','phone',
  'https://www.callersmart.com/lookup/{phone_raw}','https://www.callersmart.com/'),
n('freecarrierlookup','📞','Free Carrier Lookup','Phone carrier & line type','phone','phone',
  'https://freecarrierlookup.com/?phone={phone_raw}','https://freecarrierlookup.com/'),

/* ── EMAIL ────────────────────────────────────────────── */
n('hunter','📧','Hunter.io','Email finder & verifier','email','email',
  'https://hunter.io/email-verifier/{email}','https://hunter.io/'),
n('hibp','📧','HaveIBeenPwned','Breach check by email','email','email',
  'https://haveibeenpwned.com/account/{email}','https://haveibeenpwned.com/'),
n('emailrep','📧','EmailRep','Email reputation check','email','email',
  'https://emailrep.io/{email}','https://emailrep.io/'),
n('rocketreach','📧','RocketReach','Email & contact finder','email',null,null,
  'https://rocketreach.co/'),
n('voilanorbert','📧','Voila Norbert','Email finder','email',null,null,
  'https://www.voilanorbert.com/'),
n('epieos','📧','Epieos','Email OSINT tool','email','email',
  'https://epieos.com/?q={email}&t=email','https://epieos.com/'),
n('osindus','📧','OSINT Industries','Email & phone pivot','email','email',
  'https://app.osintindustries.net/search?query={email}','https://app.osintindustries.net/'),
n('phonebook','📧','Phonebook.cz','Intelligence X email search','email','email',
  'https://phonebook.cz/email/{email}','https://phonebook.cz/'),
n('mailtester','📧','Mail Tester','Email deliverability check','email','email',
  'https://www.mail-tester.com/','https://www.mail-tester.com/'),
n('clearbit','📧','Clearbit Connect','Company email lookup','email',null,null,
  'https://clearbit.com/'),

/* ── BREACH / DARK WEB ────────────────────────────────── */
n('dehashed','🔐','DeHashed','Leaked credentials DB','breach','email',
  'https://dehashed.com/search?query={email}','https://dehashed.com/'),
n('intelx','🔐','Intelligence X','Dark web & leaks','breach','email',
  'https://intelx.io/?s={email}','https://intelx.io/'),
n('breachdir','🔐','BreachDirectory','Breach lookup','breach','email',
  'https://breachdirectory.org/','https://breachdirectory.org/'),
n('leakcheck','🔐','LeakCheck','Email breach search','breach','email',
  'https://leakcheck.io/','https://leakcheck.io/'),
n('snusbase','🔐','Snusbase','Breach database search','breach',null,null,
  'https://snusbase.com/'),
n('spycloud','🔐','SpyCloud','Account takeover intel','breach',null,null,
  'https://spycloud.com/'),
n('ghostproject','🔐','GhostProject','Plain-text password dump search','breach','email',
  'https://ghostproject.fr/','https://ghostproject.fr/'),
n('hibp2','🔐','HIBP (Passwords)','Pwned password check','breach',null,null,
  'https://haveibeenpwned.com/Passwords'),

/* ── USERNAME ─────────────────────────────────────────── */
n('wmn','🔑','WhatsMyName','Username across 600+ sites','username','username',
  'https://whatsmyname.app/?q={username}','https://whatsmyname.app/'),
n('idcrawl','🔑','IDCrawl','Username & name search','username','username',
  'https://www.idcrawl.com/{username}','https://www.idcrawl.com/'),
n('namechk','🔑','Namechk','Username availability','username','username',
  'https://namechk.com/{username}','https://namechk.com/'),
n('usersearch','🔑','UserSearch.org','Username lookup','username','username',
  'https://usersearch.org/results_normal.php?URL_username={username}','https://usersearch.org/'),
n('knowem','🔑','KnowEm','Username on 500+ networks','username','username',
  'https://knowem.com/checkusernames.php?u={username}','https://knowem.com/'),
n('checkusernames','🔑','CheckUsernames','Social username checker','username','username',
  'https://checkusernames.com/?username={username}','https://checkusernames.com/'),
n('instantun','🔑','Instant Username Search','Real-time username check','username','username',
  'https://instantusername.com/#query={username}','https://instantusername.com/'),
n('socialblade','🔑','Social Blade','Social media stats','username','username',
  'https://socialblade.com/search/search?query={username}','https://socialblade.com/'),

/* ── SOCIAL MEDIA ─────────────────────────────────────── */
n('linkedin','📱','LinkedIn','Professional network search','social','name',
  'https://www.linkedin.com/search/results/all/?keywords={name}','https://www.linkedin.com/'),
n('twitter','📱','Twitter / X','Tweet & profile search','social','username',
  'https://twitter.com/{username}','https://twitter.com/'),
n('facebook','📱','Facebook','Profile search','social','name',
  'https://www.facebook.com/search/people/?q={name}','https://www.facebook.com/'),
n('instagram','📱','Instagram','Profile search','social','username',
  'https://www.instagram.com/{username}/','https://www.instagram.com/'),
n('tiktok','📱','TikTok','Profile search','social','username',
  'https://www.tiktok.com/@{username}','https://www.tiktok.com/'),
n('youtube','📱','YouTube','Channel search','social','name',
  'https://www.youtube.com/results?search_query={name}','https://www.youtube.com/'),
n('reddit','📱','Reddit','User profile','social','username',
  'https://www.reddit.com/user/{username}','https://www.reddit.com/'),
n('pinterest','📱','Pinterest','Profile search','social','username',
  'https://www.pinterest.com/{username}/','https://www.pinterest.com/'),
n('twitch','📱','Twitch','Channel lookup','social','username',
  'https://www.twitch.tv/{username}','https://www.twitch.tv/'),
n('snapchat','📱','Snapchat','Profile lookup','social','username',
  'https://www.snapchat.com/add/{username}','https://www.snapchat.com/'),
n('socialsearcher','📱','Social Searcher','Cross-platform search','social','name',
  'https://www.social-searcher.com/social-buzz/?q5={name}','https://www.social-searcher.com/'),
n('truthsocial','📱','Truth Social','Profile lookup','social','username',
  'https://truthsocial.com/@{username}','https://truthsocial.com/'),
n('telegram','📱','Telegram (t.me)','Channel/user lookup','social','username',
  'https://t.me/{username}','https://t.me/'),

/* ── IMAGE / FACE SEARCH ──────────────────────────────── */
n('glens','🖼️','Google Lens','Reverse image search','image','image',
  'https://lens.google.com/uploadbyurl?url={image}','https://lens.google.com/'),
n('tineye','🖼️','TinEye','Reverse image search','image','image',
  'https://tineye.com/search/?url={image}','https://tineye.com/'),
n('yandex','🖼️','Yandex Images','Yandex reverse image','image','image',
  'https://yandex.com/images/search?rpt=imageview&url={image}','https://yandex.com/images/'),
n('bing-vis','🖼️','Bing Visual Search','Bing reverse image','image','image',
  'https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:{image}','https://www.bing.com/visualsearch'),
n('pimeyes','🖼️','PimEyes','Face recognition search','image',null,null,
  'https://pimeyes.com/'),
n('saucenao','🖼️','SauceNAO','Anime/art reverse image','image','image',
  'https://saucenao.com/search.php?url={image}','https://saucenao.com/'),
n('fotoforensics','🖼️','FotoForensics','Image metadata & ELA','image','image',
  'https://fotoforensics.com/analysis.php?url={image}','https://fotoforensics.com/'),
n('exif','🖼️','Jeffrey EXIF Viewer','EXIF metadata extractor','image','image',
  'http://exif.regex.info/exif.cgi?url={image}','http://exif.regex.info/exif.cgi'),

/* ── NEWS / ARRESTS ───────────────────────────────────── */
n('arrests','📰','Arrests.org','Nationwide arrest records','news','name',
  'https://arrests.org/results/?query={name}','https://arrests.org/'),
n('mugshots','📰','Mugshots.com','Mugshot database','news','name',
  'https://mugshots.com/search.html?q={name}','https://mugshots.com/'),
n('busted','📰','BustedNewspaper','County arrest records','news','name',
  'https://bustedmugshots.com/search?q={name}','https://bustedmugshots.com/'),
n('jailbase','📰','JailBase','Arrest records search','news','name',
  'https://www.jailbase.com/search/#searchBox?searchQuery={name}','https://www.jailbase.com/'),
n('googlenews','📰','Google News','News search','news','name',
  'https://news.google.com/search?q={name}','https://news.google.com/'),
n('google','📰','Google Search','Web search','news','name',
  'https://www.google.com/search?q={name}','https://www.google.com/'),
n('fbiwanted','📰','FBI Most Wanted','FBI wanted persons','news','name',
  'https://www.fbi.gov/wanted/search?q={name}','https://www.fbi.gov/wanted'),
n('marshals','📰','US Marshals Fugitives','USMS wanted search','news','name',
  'https://www.usmarshals.gov/investigations/wanted/search/?name={name}','https://www.usmarshals.gov/investigations/wanted/'),
n('crimemapping','📰','CrimeMapping','Crime incident map','news',null,null,
  'https://www.crimemapping.com/'),
n('newspapers','📰','Newspapers.com','Historical newspaper search','news','name',
  'https://www.newspapers.com/search/#query={name}','https://www.newspapers.com/'),
n('chronicling','📰','Chronicling America','Historic US newspapers','news','name',
  'https://chroniclingamerica.loc.gov/search/pages/results/?andtext={name}','https://chroniclingamerica.loc.gov/'),

/* ── FEDERAL AGENCIES ─────────────────────────────────── */
n('fbi-records','🏛️','FBI Records Vault','FOIA released FBI records','federal',null,null,
  'https://vault.fbi.gov/'),
n('ofac','🏛️','OFAC Sanctions','Sanctioned persons & entities','federal','name',
  'https://sanctionssearch.ofac.treas.gov/','https://sanctionssearch.ofac.treas.gov/'),
n('sam','🏛️','SAM.gov','Federal contractor/debarment','federal','name',
  'https://sam.gov/search/?keywords={name}','https://sam.gov/'),
n('sec-edgar','🏛️','SEC EDGAR','Public company filings','federal','name',
  'https://www.sec.gov/cgi-bin/browse-edgar?company={name}&action=getcompany','https://www.sec.gov/cgi-bin/browse-edgar'),
n('fcc','🏛️','FCC License Search','FCC license lookup','federal','name',
  'https://wireless2.fcc.gov/UlsApp/UlsSearch/searchLicense.jsp?licKey=&selectCat=B&radioservice=&status=A&dateType=grant&fromDate=&toDate=&ulsFRN=&frnName={name}','https://wireless2.fcc.gov/UlsApp/UlsSearch/'),
n('faa-pilot','🏛️','FAA Pilot Certificates','Airman certificate lookup','federal','name',
  'https://amsrvs.registry.faa.gov/airmeninquiry/Main.aspx','https://amsrvs.registry.faa.gov/airmeninquiry/'),
n('faa-aircraft','🏛️','FAA Aircraft Registry','N-number / owner search','federal','name',
  'https://registry.faa.gov/aircraftinquiry/Search/NNumberInquiry','https://registry.faa.gov/aircraftinquiry/'),
n('interpol','🏛️','INTERPOL Notices','International wanted notices','federal','name',
  'https://www.interpol.int/How-we-work/Notices/View-Red-Notices','https://www.interpol.int/'),
n('hhs-oig','🏛️','HHS OIG Exclusions','Healthcare exclusions list','federal','name',
  'https://exclusions.oig.hhs.gov/','https://exclusions.oig.hhs.gov/'),
n('atf','🏛️','ATF (FFL Lookup)','Federal firearms licensees','federal',null,null,
  'https://www.atf.gov/firearms/licensed-dealer-locator'),
n('gsa-debar','🏛️','GSA Debarment','Excluded parties list','federal','name',
  'https://www.epls.gov/','https://www.epls.gov/'),
n('pacer-fed','🏛️','PACER (Federal Courts)','Federal case filings','federal',null,null,
  'https://pacer.uscourts.gov/'),
n('usajobs','🏛️','USAJobs Resume Search','Federal employment portal','federal',null,null,
  'https://www.usajobs.gov/'),

/* ── PROFESSIONAL LICENSES ────────────────────────────── */
n('npi','🎓','NPI Registry','Healthcare provider NPI','professional','name',
  'https://npiregistry.cms.hhs.gov/search?name_last={last}&name_first={first}&enumeration_type=NPI-1','https://npiregistry.cms.hhs.gov/'),
n('finra','🎓','FINRA BrokerCheck','Broker & advisor history','professional','name',
  'https://brokercheck.finra.org/search/genericsearch/nameSearch?searchQuery={name}','https://brokercheck.finra.org/'),
n('nmls','🎓','NMLS Consumer Access','Mortgage & finance licenses','professional','name',
  'https://www.nmlsconsumeraccess.org/EntityDetails.aspx/INDIVIDUAL/search?name={name}','https://www.nmlsconsumeraccess.org/'),
n('aba-lawyer','🎓','ABA Lawyer Search','Licensed attorneys','professional','name',
  'https://www.americanbar.org/groups/legal_services/flh-home/','https://www.americanbar.org/'),
n('nursys','🎓','Nursys','Nurse license verification','professional','name',
  'https://www.nursys.com/LQC/LQCSearch.aspx','https://www.nursys.com/'),
n('oig-excl','🎓','OIG Exclusions','HHS excluded providers','professional','name',
  'https://exclusions.oig.hhs.gov/','https://exclusions.oig.hhs.gov/'),
n('avvo','🎓','Avvo Lawyer Finder','Attorney profiles & ratings','professional','name',
  'https://www.avvo.com/find-a-lawyer?q={name}','https://www.avvo.com/'),
n('dea-prac','🎓','DEA Practitioner','DEA registered practitioners','professional',null,null,
  'https://www.deadiversion.usdoj.gov/webforms/validateLogin.jsp'),
n('doctorlookup','🎓','DocInfo (ABMS)','Board-certified physician lookup','professional',null,null,
  'https://www.certificationmatters.org/is-your-doctor-board-certified/'),

/* ── FINANCIAL ────────────────────────────────────────── */
n('sec-fin','💰','SEC EDGAR Persons','Individual filings search','financial','name',
  'https://efts.sec.gov/LATEST/search-index?q="{name}"&dateRange=custom&startdt=2000-01-01','https://efts.sec.gov/LATEST/search-index'),
n('pacer-bk','💰','PACER Bankruptcy','Federal bankruptcy filings','financial',null,null,
  'https://pcl.uscourts.gov/pcl/pages/search/findBankruptcyCases.jsf'),
n('opensecrets','💰','OpenSecrets','Political donations lookup','financial','name',
  'https://www.opensecrets.org/donor-lookup/results?name={name}','https://www.opensecrets.org/donor-lookup'),
n('fec','💰','FEC Donor Search','Federal campaign contributions','financial','name',
  'https://www.fec.gov/data/receipts/?contributor_name={name}','https://www.fec.gov/data/receipts/'),
n('fdic','💰','FDIC BankFind','Bank/institution lookup','financial','name',
  'https://banks.data.fdic.gov/api/institutions?filters=INSTNAME%3A{name}&fields=NAME,CITY,STNAME,REPDTE&limit=10','https://www.fdic.gov/bank/individual/'),
n('cfpb','💰','CFPB Complaints','Consumer finance complaints','financial','name',
  'https://www.consumerfinance.gov/data-research/consumer-complaints/search/?issue={name}','https://www.consumerfinance.gov/data-research/consumer-complaints/'),
n('bankruptcydata','💰','BankruptcyData.com','Public bankruptcy filings','financial','name',
  'https://www.bankruptcydata.com/research/individual?name={name}','https://www.bankruptcydata.com/research/individual'),
n('docketbird','💰','DocketBird','Federal court dockets','financial',null,null,
  'https://docketbird.com/'),

/* ── GENEALOGY ────────────────────────────────────────── */
n('ftn','🌳','FamilyTreeNow (Genealogy)','Free family tree search','genealogy','name',
  'https://www.familytreenow.com/search/genealogy/results?first={first}&last={last}','https://www.familytreenow.com/'),
n('familysearch','🌳','FamilySearch','LDS genealogy records','genealogy','name',
  'https://www.familysearch.org/search/record/results?q.givenName={first}&q.surname={last}','https://www.familysearch.org/'),
n('ancestry','🌳','Ancestry.com','Genealogy records & DNA','genealogy',null,null,
  'https://www.ancestry.com/'),
n('findagrave','🌳','Find A Grave','Cemetery & memorial records','genealogy','name',
  'https://www.findagrave.com/memorial/search?firstname={first}&lastname={last}','https://www.findagrave.com/'),
n('myheritage','🌳','MyHeritage','Family history & DNA','genealogy',null,null,
  'https://www.myheritage.com/'),
n('genealogybank','🌳','GenealogyBank','Obituaries & newspapers','genealogy','name',
  'https://www.genealogybank.com/gbnk/bin/gbnk_gsearch?from=&to=&type=Historical+Newspapers&terms={name}','https://www.genealogybank.com/'),
n('fold3','🌳','Fold3','Military records','genealogy',null,null,
  'https://www.fold3.com/'),
n('billiongraves','🌳','BillionGraves','GPS-tagged cemetery records','genealogy','name',
  'https://billiongraves.com/search/results?given_names={first}&family_names={last}','https://billiongraves.com/'),
n('ssdi','🌳','SSDI Search','Social Security Death Index','genealogy','name',
  'https://www.genealogybank.com/gbnk/ssdi/search?fname={first}&lname={last}','https://www.genealogybank.com/gbnk/ssdi/'),
n('vitalrec','🌳','VitalRec.com','Vital records directory','genealogy',null,null,
  'https://www.vitalrec.com/'),

/* ── VEHICLES ─────────────────────────────────────────── */
n('nhtsa','🚗','NHTSA VIN Decoder','Official VIN decode & recalls','vehicle','vin',
  'https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/{vin}?format=json','https://vpic.nhtsa.dot.gov/'),
n('nicb','🚗','NICB VINCheck','Stolen/salvage VIN check','vehicle','vin',
  'https://www.nicb.org/vincheck','https://www.nicb.org/vincheck'),
n('vehiclehistory','🚗','VehicleHistory.com','Free vehicle history','vehicle','vin',
  'https://www.vehiclehistory.com/reports/{vin}','https://www.vehiclehistory.com/'),
n('iseecars','🚗','iSeeCars VIN','Vehicle history report','vehicle','vin',
  'https://www.iseecars.com/vin#{vin}','https://www.iseecars.com/'),
n('autocheck','🚗','AutoCheck','Vehicle history by VIN','vehicle','vin',
  'https://www.autocheck.com/vehiclehistory/autocheck/en/vehiclehistory?vin={vin}','https://www.autocheck.com/'),
n('carfax','🚗','CARFAX VIN Check','Full vehicle history report','vehicle','vin',
  'https://www.carfax.com/VehicleHistory/p/Report.cfx?vin={vin}','https://www.carfax.com/'),
n('nhtsa-safety','🚗','NHTSA Safety Ratings','Crash test & recall lookup','vehicle','vin',
  'https://www.nhtsa.gov/vehicle/{vin}','https://www.nhtsa.gov/'),
n('dmv-org','🚗','DMV.org Plate Lookup','License plate resources','vehicle',null,null,
  'https://www.dmv.org/'),

/* ── DOMAIN / IP ──────────────────────────────────────── */
n('domaintools','🌐','DomainTools WHOIS','Domain ownership history','domain','domain',
  'https://whois.domaintools.com/{domain}','https://whois.domaintools.com/'),
n('shodan','🌐','Shodan','Internet device search engine','domain','domain',
  'https://www.shodan.io/search?query={domain}','https://www.shodan.io/'),
n('virustotal','🌐','VirusTotal','URL/domain threat analysis','domain','domain',
  'https://www.virustotal.com/gui/domain/{domain}','https://www.virustotal.com/'),
n('urlscan','🌐','URLScan.io','Website scanner & history','domain','domain',
  'https://urlscan.io/search/#domain:{domain}','https://urlscan.io/'),
n('ipinfo','🌐','IPInfo','IP geolocation & ASN','domain','domain',
  'https://ipinfo.io/{domain}','https://ipinfo.io/'),
n('sectrails','🌐','SecurityTrails','DNS history & subdomains','domain','domain',
  'https://securitytrails.com/domain/{domain}/dns','https://securitytrails.com/'),
n('builtwith','🌐','BuiltWith','Website technology lookup','domain','domain',
  'https://builtwith.com/{domain}','https://builtwith.com/'),
n('censys','🌐','Censys','Internet-wide scan data','domain','domain',
  'https://search.censys.io/hosts?q={domain}','https://search.censys.io/'),
n('viewdns','🌐','ViewDNS.info','DNS & IP tools','domain','domain',
  'https://viewdns.info/iphistory/?domain={domain}','https://viewdns.info/'),
n('dnsdumpster','🌐','DNSDumpster','DNS recon & mapping','domain','domain',
  'https://dnsdumpster.com/','https://dnsdumpster.com/'),
n('abuseipdb','🌐','AbuseIPDB','IP abuse reports','domain','domain',
  'https://www.abuseipdb.com/check/{domain}','https://www.abuseipdb.com/'),
n('bgpview','🌐','BGPView','ASN & IP routing info','domain','domain',
  'https://bgpview.io/ip/{domain}','https://bgpview.io/'),
];

/* ── ROUTING MAPS ─────────────────────────────────────── */
const TAB_CAT_MAP={
  courts:'courts',doc:'doc',sor:'sor',
  state:'state',people:'people',phone:'phone',email:'email',
  breach:'breach',username:'username',social:'social',image:'image',
  news:'news',federal:'federal',professional:'professional',
  financial:'financial',genealogy:'genealogy',vehicle:'vehicle',domain:'domain'
};

const STATE_CAT_MAP={
  courts:['courts'],doc:['doc'],sor:['sor'],
  state:['sos','prop','voter','license']
};

const CAT_ICONS={
  courts:'⚖️',doc:'🔒',sor:'🚨',sos:'🏢',prop:'🏠',voter:'🗳️',license:'📋',
  state:'📂',people:'👥',phone:'📞',email:'📧',breach:'🔐',username:'🔑',
  social:'📱',image:'🖼️',news:'📰',federal:'🏛️',professional:'🎓',
  financial:'💰',genealogy:'🌳',vehicle:'🚗',domain:'🌐'
};

const CAT_LABELS={
  courts:'Courts',doc:'Corrections',sor:'Sex Offender',sos:'Secretary of State',
  prop:'Property Records',voter:'Voter Registration',license:'Professional License',
  state:'State Records',people:'People Search',phone:'Phone Lookup',
  email:'Email Lookup',breach:'Breach / Dark Web',username:'Username Search',
  social:'Social Media',image:'Image / Face',news:'News & Arrests',
  federal:'Federal Agencies',professional:'Professional Licenses',
  financial:'Financial',genealogy:'Genealogy',vehicle:'Vehicles',domain:'Domain / IP'
};

/* ══════════════════════════════════════════════════════════
   PROFILE / MULTI-USER SYSTEM (localStorage-based)
   Each profile has its own namespaced keys:
     hyve_${id}_subjects, hyve_${id}_notes, hyve_${id}_hits
   ══════════════════════════════════════════════════════════ */
const PROFILES_KEY='hyve_sleuth_profiles';
const CURRENT_PROF_KEY='hyve_sleuth_current';

function getAllProfiles(){
  try{return JSON.parse(localStorage.getItem(PROFILES_KEY)||'[]');}
  catch{return[];}
}
function saveAllProfiles(arr){localStorage.setItem(PROFILES_KEY,JSON.stringify(arr));}

function getCurrentProfile(){
  const id=localStorage.getItem(CURRENT_PROF_KEY);
  if(!id)return null;
  return getAllProfiles().find(p=>p.id===id)||null;
}
function setCurrentProfile(id){localStorage.setItem(CURRENT_PROF_KEY,id);}

function createProfile(name,emoji,pin){
  const id='p_'+Date.now();
  const prof={id,name,emoji,pin:pin||'',created:Date.now()};
  const all=getAllProfiles();
  all.push(prof);
  saveAllProfiles(all);
  return prof;
}
function deleteProfile(id){
  const all=getAllProfiles().filter(p=>p.id!==id);
  saveAllProfiles(all);
  /* clear profile data */
  ['subjects','notes','hits'].forEach(k=>localStorage.removeItem(`hyve_${id}_${k}`));
  if(localStorage.getItem(CURRENT_PROF_KEY)===id)localStorage.removeItem(CURRENT_PROF_KEY);
}

/* profile-namespaced data helpers */
let _prof=null; /* active profile object */
function ns(key){return`hyve_${_prof?_prof.id:'default'}_${key}`;}
function pGet(key){try{return JSON.parse(localStorage.getItem(ns(key)));}catch{return null;}}
function pSet(key,val){localStorage.setItem(ns(key),JSON.stringify(val));}

/* ── APP STATE ────────────────────────────────────────── */
let subject=null, activeTab='all', urlReg=[];

/* ── SUBJECT FORM ─────────────────────────────────────── */
function readForm(){
  return{
    name:document.getElementById('i-name').value.trim(),
    dob:document.getElementById('i-dob').value.trim(),
    city:document.getElementById('i-city').value.trim(),
    state:document.getElementById('i-state').value,
    phone:document.getElementById('i-phone').value.trim(),
    email:document.getElementById('i-email').value.trim(),
    username:document.getElementById('i-user').value.trim(),
    address:document.getElementById('i-addr').value.trim(),
    domain:document.getElementById('i-domain').value.trim(),
    vin:document.getElementById('i-vin').value.trim(),
    image:document.getElementById('i-img').value.trim(),
  };
}

function fillForm(s){
  document.getElementById('i-name').value=s.name||'';
  document.getElementById('i-dob').value=s.dob||'';
  document.getElementById('i-city').value=s.city||'';
  document.getElementById('i-state').value=s.state||'';
  document.getElementById('i-phone').value=s.phone||'';
  document.getElementById('i-email').value=s.email||'';
  document.getElementById('i-user').value=s.username||'';
  document.getElementById('i-addr').value=s.address||'';
  document.getElementById('i-domain').value=s.domain||'';
  document.getElementById('i-vin').value=s.vin||'';
  document.getElementById('i-img').value=s.image||'';
}

function isProvided(s,field){
  if(!field)return true;
  if(field==='name')return!!(s.name);
  if(field==='phone')return!!(s.phone);
  if(field==='email')return!!(s.email);
  if(field==='username')return!!(s.username);
  if(field==='address')return!!(s.address);
  if(field==='domain')return!!(s.domain);
  if(field==='vin')return!!(s.vin);
  if(field==='image')return!!(s.image);
  return true;
}

/* ── RESOURCE RESOLVER ────────────────────────────────── */
function resolveResource(res,s){
  const url=buildUrl(res.sm,s)||buildUrl(res.bs,s)||res.sm||res.bs||null;
  return{url,smart:!!(res.sm&&buildUrl(res.sm,s)&&isProvided(s,res.rq))};
}

function getStateResources(s){
  if(!s||!s.state)return[];
  const st=STATE_DB[s.state];
  if(!st)return[];
  const cats=['courts','doc','sor','sos','prop','voter','license'];
  return cats.map(c=>{
    const res=st[c];
    if(!res)return null;
    const url=buildUrl(res.s,s)||res.b;
    const smart=!!(res.s&&buildUrl(res.s,s));
    return{id:`st_${s.state}_${c}`,ic:CAT_ICONS[c]||'📂',lb:res.l,sb:st.name,
      ct:c,url,smart,isState:true,stateCat:c};
  }).filter(Boolean);
}

function getNatResources(cat,s){
  const src=cat==='all'?NAT:NAT.filter(r=>r.ct===cat);
  return src.map(res=>{
    const{url,smart}=resolveResource(res,s||{});
    return{...res,url,smart,resolved:true};
  });
}

function countSmart(items){return items.filter(i=>i.smart).length;}

/* ── BUTTON BUILDER ───────────────────────────────────── */
function buildBtn(item,idx){
  urlReg[idx]=item.url||item.bs||'#';
  const dimmed=!item.smart&&item.rq&&subject&&!isProvided(subject,item.rq);
  const hit=getResourceHit(item.id);
  const badge=item.isState?'<span class="badge badge-st">STATE</span>':
    (item.ct==='federal'?'<span class="badge badge-fed">FED</span>':
    '<span class="badge badge-nat">NAT</span>');
  return`<button class="rb${item.smart?' smart-active':''}${dimmed?' dim':''}${hit==='hit'?' found':hit==='miss'?' nope':''}" data-idx="${idx}" title="${esc(item.lb)}">
    <span class="ri">${item.ic||'🔗'}</span>
    <span class="rb-body">
      <span class="rl2">${esc(item.lb)}</span>
      <span class="rs">${esc(item.sb||'')}</span>
    </span>
    ${badge}
    ${item.smart?'<span class="spill">SMART</span>':''}
    <span class="hm-row">
      <button class="hm-btn${hit==='hit'?' active-hit':''}" data-hm="hit" data-res="${esc(item.id)}" title="Mark: Found">✓</button>
      <button class="hm-btn${hit==='miss'?' active-miss':''}" data-hm="miss" data-res="${esc(item.id)}" title="Mark: No result">✕</button>
    </span>
  </button>`;
}

/* ── SECTION RENDERER ─────────────────────────────────── */
function renderSection(label,cat,items,icon){
  if(!items.length)return'';
  const smartN=countSmart(items);
  const btns=items.map((_,i)=>buildBtn(items[i],urlReg.length+i));
  /* re-map because buildBtn uses urlReg.length — do it properly: */
  urlReg.length; /* already consumed above */
  return`<div class="rsec">
    <div class="rsec-hdr">
      <span>${icon||CAT_ICONS[cat]||'📂'}</span>
      <span class="rl">${esc(label||CAT_LABELS[cat]||cat)}</span>
      ${smartN?`<span style="font-size:11px;color:var(--teal);margin-left:4px">${smartN} smart</span>`:''}
    </div>
    <div class="rgrid">${btns.join('')}</div>
  </div>`;
}

/* ── SECTION HTML HELPER ──────────────────────────────── */
function secHtml(icon,label,items,btns){
  const smartUrls=items.filter(i=>i.smart&&i.url&&i.url!=='#').map(i=>i.url);
  const launchBtn=smartUrls.length
    ?`<button class="sec-launch" data-sec-launch="${encodeURIComponent(JSON.stringify(smartUrls))}" title="Launch all smart links in this section">⚡ Launch (${smartUrls.length})</button>`
    :'';
  const smartLabel=countSmart(items)?`<span style="font-size:11px;color:var(--teal);margin-left:4px">${countSmart(items)} smart</span>`:'';
  return`<div class="rsec"><div class="rsec-hdr"><span>${icon}</span><span class="rl">${esc(label)}</span>${smartLabel}${launchBtn}</div><div class="rgrid">${btns}</div></div>`;
}

/* ── TAB CONTENT RENDERER ─────────────────────────────── */
function renderTab(tab,s){
  if(!s)return`<div class="welcome"><div class="wi">🔎</div><div class="wt">No Subject Loaded</div><div class="ws">Fill in at least a name and click <strong>Load</strong> to open the full resource panel.</div></div>`;

  urlReg=[];
  let html='';

  /* subject banner */
  html+=renderBanner(s);

  if(tab==='all'){
    /* state resources first */
    if(s.state){
      const stRes=getStateResources(s);
      const stateCats=['courts','doc','sor','sos','prop','voter','license'];
      stateCats.forEach(cat=>{
        const items=stRes.filter(r=>r.stateCat===cat);
        if(items.length){
          const base=urlReg.length;
          const btns=items.map((item,i)=>buildBtn(item,base+i)).join('');
          urlReg.push(...items.map(item=>item.url||'#'));
          html+=secHtml(CAT_ICONS[cat]||'📂',(SN[s.state]||s.state)+' — '+CAT_LABELS[cat],items,btns);
        }
      });
    }
    /* national resources by category */
    Object.keys(TAB_CAT_MAP).forEach(cat=>{
      const items=NAT.filter(r=>r.ct===cat).map(res=>{
        const{url,smart}=resolveResource(res,s);
        return{...res,url,smart};
      });
      if(items.length){
        const base=urlReg.length;
        const btns=items.map((item,i)=>buildBtn(item,base+i)).join('');
        urlReg.push(...items.map(item=>item.url||'#'));
        html+=secHtml(CAT_ICONS[cat]||'📂',CAT_LABELS[cat]||cat,items,btns);
      }
    });
  } else if(STATE_CAT_MAP[tab]){
    /* pure state-record tab */
    if(s.state){
      const stRes=getStateResources(s);
      const cats=STATE_CAT_MAP[tab];
      cats.forEach(cat=>{
        const items=stRes.filter(r=>r.stateCat===cat);
        if(items.length){
          const base=urlReg.length;
          const btns=items.map((item,i)=>buildBtn(item,base+i)).join('');
          urlReg.push(...items.map(item=>item.url||'#'));
          html+=secHtml(CAT_ICONS[cat]||'📂',CAT_LABELS[cat]||cat,items,btns);
        }
      });
    } else {
      html+=`<div class="disc">Select a state in the sidebar to see state-specific resources for this tab.</div>`;
    }
  } else {
    /* state tabs that also have national resources */
    const natCat=TAB_CAT_MAP[tab];
    if(s.state&&STATE_CAT_MAP[tab]){
      const stRes=getStateResources(s);
      const stateCats=STATE_CAT_MAP[tab]||[];
      stateCats.forEach(cat=>{
        const items=stRes.filter(r=>r.stateCat===cat);
        if(items.length){
          const base=urlReg.length;
          const btns=items.map((item,i)=>buildBtn(item,base+i)).join('');
          urlReg.push(...items.map(item=>item.url||'#'));
          html+=`<div class="rsec"><div class="rsec-hdr"><span>${CAT_ICONS[cat]||'📂'}</span><span class="rl">${esc((SN[s.state]||s.state)+' — '+CAT_LABELS[cat])}</span></div><div class="rgrid">${btns}</div></div>`;
        }
      });
    }
    if(natCat){
      const items=NAT.filter(r=>r.ct===natCat).map(res=>{
        const{url,smart}=resolveResource(res,s);
        return{...res,url,smart};
      });
      if(items.length){
        const base=urlReg.length;
        const btns=items.map((item,i)=>buildBtn(item,base+i)).join('');
        urlReg.push(...items.map(item=>item.url||'#'));
        html+=secHtml(CAT_ICONS[natCat]||'📂',CAT_LABELS[natCat]||natCat,items,btns);
      }
    }
  }

  html+=`<div class="disc">⚠️ Hyve opens official public records in new tabs. No scraping. For authorized research only. Verify all data with primary sources.</div>`;
  return html;
}

function renderBanner(s){
  if(!s)return'';
  const parts=[s.dob,s.city,s.state?SN[s.state]||s.state:''].filter(Boolean);
  return`<div id="subj-banner">
    ${s.image?`<img src="${esc(s.image)}" onerror="this.style.display='none'" alt="Subject"/>`:''}
    <div class="sbd">
      <div class="sbn">${esc(s.name||'Unknown Subject')}</div>
      <div class="sbr">${parts.map(p=>`<span>${esc(p)}</span>`).join('<span style="color:var(--border)">·</span>')}</div>
      ${s.phone?`<div class="sbr"><span style="color:var(--muted)">📞</span><span>${esc(s.phone)}</span></div>`:''}
      ${s.email?`<div class="sbr"><span style="color:var(--muted)">📧</span><span>${esc(s.email)}</span></div>`:''}
    </div>
  </div>`;
}

/* ── TAB BAR ──────────────────────────────────────────── */
function renderTabBar(){
  const bar=document.getElementById('tab-bar');
  bar.innerHTML=TABS.map(t=>{
    const isActive=t.id===activeTab;
    let count='';
    if(subject&&t.id!=='all'){
      const natCat=TAB_CAT_MAP[t.id];
      const stCats=STATE_CAT_MAP[t.id]||[];
      let n=natCat?NAT.filter(r=>r.ct===natCat).length:0;
      if(subject.state&&stCats.length){
        const st=STATE_DB[subject.state];
        if(st)n+=stCats.filter(c=>st[c]).length;
      }
      count=n?`<span class="tc">${n}</span>`:'';
    }
    return`<button class="tab${isActive?' active':''}" data-tab="${t.id}">${t.icon} ${t.label}${count}</button>`;
  }).join('');
}

/* ── HEADER ───────────────────────────────────────────── */
function updateHeader(){
  const st=document.getElementById('subj-status');
  const sc=document.getElementById('smart-count');
  const btn=document.getElementById('btn-launch-all');
  if(!subject){
    st.innerHTML='No subject loaded';
    sc.style.display='none';
    btn.disabled=true;
    return;
  }
  st.innerHTML=`<strong>${esc(subject.name||'Subject')}</strong>`;
  /* count all smart links */
  const allNat=NAT.map(res=>resolveResource(res,subject));
  const natSmart=allNat.filter(r=>r.smart).length;
  const stSmart=subject.state?getStateResources(subject).filter(r=>r.smart).length:0;
  const total=natSmart+stSmart;
  if(total){
    sc.textContent=`⚡ ${total} smart links ready`;
    sc.style.display='';
    btn.disabled=false;
  } else {
    sc.style.display='none';
    btn.disabled=true;
  }
}

/* ── FULL RENDER ──────────────────────────────────────── */
function fullRender(){
  renderTabBar();
  updateHeader();
  const content=document.getElementById('tab-content');
  content.innerHTML=renderTab(activeTab,subject);
}

/* ── PERSISTENCE (profile-namespaced) ─────────────────── */
function getSaved(){return pGet('subjects')||[];}
function setSaved(arr){pSet('subjects',arr);}

/* ── HIT / MISS TRACKING ──────────────────────────────── */
function subjKey(s){return(s&&s.name)?s.name.toLowerCase().replace(/\s+/g,'_'):'anon';}
function getHits(){return pGet('hits')||{};}
function setHits(obj){pSet('hits',obj);}
function getResourceHit(resId){
  if(!subject)return null;
  const h=getHits();
  return(h[subjKey(subject)]||{})[resId]||null;
}
function toggleHit(resId,val){
  if(!subject)return;
  const h=getHits();
  const k=subjKey(subject);
  if(!h[k])h[k]={};
  if(h[k][resId]===val)delete h[k][resId]; else h[k][resId]=val;
  setHits(h);
}

/* ── NOTES ────────────────────────────────────────────── */
function getNotes(s){
  if(!s)return'';
  const n=pGet('notes')||{};
  return n[subjKey(s)]||'';
}
function setNotes(s,text){
  if(!s)return;
  const n=pGet('notes')||{};
  n[subjKey(s)]=text;
  pSet('notes',n);
}
function syncNotesUI(){
  const ta=document.getElementById('research-notes');
  if(ta)ta.value=subject?getNotes(subject):'';
}

function renderSavedList(){
  const el=document.getElementById('saved-list');
  const saved=getSaved();
  if(!saved.length){
    el.innerHTML=`<div class="empty">No saved subjects<small>Fill in fields and click Save</small></div>`;
    return;
  }
  el.innerHTML=saved.map((s,i)=>`
    <div class="sc">
      <div class="sn">${esc(s.name||'Unnamed')}</div>
      <div class="sm">${[s.city,s.state?SN[s.state]||s.state:''].filter(Boolean).join(', ')||'No location'}</div>
      <div class="sa">
        <button class="btn btn-p" style="font-size:11px;padding:3px 8px" data-load="${i}">Load</button>
        <button class="btn-d btn" data-del="${i}">✕</button>
      </div>
    </div>`).join('');
}

/* ── ACTIONS ──────────────────────────────────────────── */
function doLoad(){
  const s=readForm();
  if(!s.name){alert('Enter at least a Full Name to load a subject.');return;}
  subject=s;
  syncNotesUI();
  fullRender();
}

function doSave(){
  const s=readForm();
  if(!s.name){alert('Enter at least a Full Name to save.');return;}
  /* also save current notes */
  const ta=document.getElementById('research-notes');
  if(ta&&subject)setNotes(subject,ta.value.trim());
  const saved=getSaved();
  const idx=saved.findIndex(x=>x.name.toLowerCase()===s.name.toLowerCase());
  if(idx>=0)saved[idx]=s; else saved.unshift(s);
  setSaved(saved);
  renderSavedList();
}

function doClear(){
  subject=null;
  fillForm({});
  syncNotesUI();
  fullRender();
}

function doExport(){
  if(!subject){alert('Load a subject first.');return;}
  const hits=getHits()[subjKey(subject)]||{};
  const notes=getNotes(subject);
  const found=Object.entries(hits).filter(([,v])=>v==='hit').map(([id])=>id);
  const missed=Object.entries(hits).filter(([,v])=>v==='miss').map(([id])=>id);
  const getNatLabel=id=>{const r=NAT.find(x=>x.id===id);return r?r.lb:id;};

  const lines=[
    '═══════════════════════════════════════',
    '  HYVE SLEUTH — RESEARCH REPORT',
    '  A Majixx Corp Project',
    '═══════════════════════════════════════',
    `Generated: ${new Date().toLocaleString()}`,
    `Researcher: ${_prof?_prof.emoji+' '+_prof.name:'Unknown'}`,
    '',
    '── SUBJECT ─────────────────────────────',
    `Name:     ${subject.name||'—'}`,
    `DOB:      ${subject.dob||'—'}`,
    `Location: ${[subject.city,subject.state?SN[subject.state]||subject.state:''].filter(Boolean).join(', ')||'—'}`,
    `Phone:    ${subject.phone||'—'}`,
    `Email:    ${subject.email||'—'}`,
    `Username: ${subject.username||'—'}`,
    `Address:  ${subject.address||'—'}`,
    `Domain:   ${subject.domain||'—'}`,
    `VIN:      ${subject.vin||'—'}`,
    '',
    '── FINDINGS (HIT) ──────────────────────',
    ...(found.length?found.map(id=>`  ✓ ${getNatLabel(id)}`):['  (none marked)']),
    '',
    '── NO RESULT (MISS) ────────────────────',
    ...(missed.length?missed.map(id=>`  ✕ ${getNatLabel(id)}`):['  (none marked)']),
    '',
    '── RESEARCH NOTES ──────────────────────',
    notes||'  (none)',
    '',
    '═══════════════════════════════════════',
    'For authorized research use only.',
    'Not FCRA compliant.',
  ];

  const blob=new Blob([lines.join('\n')],{type:'text/plain'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`HyveSleuth_${(subject.name||'report').replace(/\s+/g,'_')}_${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function doLaunchAll(){
  if(!subject)return;
  const allNat=NAT.filter(r=>r.sm&&isProvided(subject,r.rq)).map(r=>buildUrl(r.sm,subject)).filter(Boolean);
  const stSmart=subject.state?getStateResources(subject).filter(r=>r.smart).map(r=>r.url).filter(Boolean):[];
  const all=[...new Set([...allNat,...stSmart])];
  if(!all.length){alert('No smart links available. Add more subject info.');return;}
  if(all.length>30&&!confirm(`Open ${all.length} tabs?`))return;
  all.forEach(u=>window.open(u,'_blank','noopener'));
}

/* ── EVENT LISTENERS ──────────────────────────────────── */
document.getElementById('btn-load').addEventListener('click',doLoad);
document.getElementById('btn-save').addEventListener('click',doSave);
document.getElementById('btn-clear').addEventListener('click',doClear);
document.getElementById('btn-launch-all').addEventListener('click',doLaunchAll);
document.getElementById('btn-export').addEventListener('click',doExport);
document.getElementById('btn-export-subj').addEventListener('click',doExport);

/* notes save */
document.getElementById('btn-save-notes').addEventListener('click',()=>{
  const ta=document.getElementById('research-notes');
  if(!subject){alert('Load a subject first.');return;}
  setNotes(subject,ta.value.trim());
  /* brief flash to confirm */
  const btn=document.getElementById('btn-save-notes');
  btn.textContent='✓ Saved!';setTimeout(()=>{btn.textContent='Save Notes';},1200);
});

/* profile bar click → show profile selector */
document.getElementById('prof-bar').addEventListener('click',()=>showProfileSelector());

/* tutorial open/close */
document.getElementById('btn-tut').addEventListener('click',()=>{
  document.getElementById('tut-overlay').classList.add('show');
});
document.getElementById('btn-tut-close').addEventListener('click',()=>{
  document.getElementById('tut-overlay').classList.remove('show');
});
document.getElementById('tut-overlay').addEventListener('click',e=>{
  if(e.target===document.getElementById('tut-overlay'))
    document.getElementById('tut-overlay').classList.remove('show');
});

/* footer disclaimer link */
const footerDisc=document.getElementById('footer-disc-link');
if(footerDisc)footerDisc.addEventListener('click',e=>{
  e.preventDefault();
  const ov=document.getElementById('disc-overlay');
  ov.style.opacity='1';ov.style.display='flex';
});

/* tab bar delegation */
document.getElementById('tab-bar').addEventListener('click',e=>{
  const btn=e.target.closest('[data-tab]');
  if(!btn)return;
  activeTab=btn.dataset.tab;
  fullRender();
  document.getElementById('tab-content').scrollTop=0;
});

/* resource button delegation — handles both open and hit/miss */
document.getElementById('tab-content').addEventListener('click',e=>{
  /* hit/miss buttons first (stop propagation to parent .rb) */
  const hmBtn=e.target.closest('[data-hm]');
  if(hmBtn){
    e.stopPropagation();
    const resId=hmBtn.dataset.res;
    const val=hmBtn.dataset.hm;
    toggleHit(resId,val);
    /* re-render just the button's parent rb for speed */
    fullRender();
    return;
  }
  /* per-section launch button */
  const secLaunch=e.target.closest('[data-sec-launch]');
  if(secLaunch){
    e.stopPropagation();
    const urls=JSON.parse(decodeURIComponent(secLaunch.dataset.secLaunch));
    if(!urls.length)return;
    if(urls.length>15&&!confirm(`Open ${urls.length} tabs?`))return;
    urls.forEach(u=>window.open(u,'_blank','noopener'));
    return;
  }
  /* resource button open */
  const btn=e.target.closest('[data-idx]');
  if(!btn)return;
  const idx=parseInt(btn.dataset.idx,10);
  const url=urlReg[idx];
  if(url&&url!=='#')window.open(url,'_blank','noopener');
});

/* saved list delegation */
document.getElementById('saved-list').addEventListener('click',e=>{
  const loadBtn=e.target.closest('[data-load]');
  const delBtn=e.target.closest('[data-del]');
  if(loadBtn){
    const idx=parseInt(loadBtn.dataset.load,10);
    const saved=getSaved();
    if(saved[idx]){fillForm(saved[idx]);subject=saved[idx];fullRender();}
  }
  if(delBtn){
    const idx=parseInt(delBtn.dataset.del,10);
    const saved=getSaved();
    saved.splice(idx,1);
    setSaved(saved);
    renderSavedList();
  }
});

/* re-render on input change if subject is loaded */
['i-name','i-dob','i-city','i-state','i-phone','i-email','i-user','i-addr','i-domain','i-vin','i-img'].forEach(id=>{
  const el=document.getElementById(id);
  if(el)el.addEventListener('input',()=>{if(subject)subject=readForm();});
});

/* ══════════════════════════════════════════════════════
   PROFILE SELECTOR UI
   ══════════════════════════════════════════════════════ */
function showProfileSelector(){
  const overlay=document.getElementById('prof-overlay');
  const grid=document.getElementById('prof-grid');
  const profiles=getAllProfiles();
  grid.innerHTML=profiles.length?profiles.map(p=>`
    <div class="prof-card" data-pid="${p.id}">
      <div class="pc-em">${p.emoji||'🕵️'}</div>
      <div class="pc-name">${esc(p.name)}</div>
      <button class="pc-del" data-del="${p.id}" title="Delete profile">✕</button>
    </div>`).join(''):'<div style="color:var(--muted);font-size:12px;grid-column:1/-1;text-align:center;padding:12px 0">No profiles yet. Create one below.</div>';
  overlay.classList.add('show');
}
function hideProfileSelector(){document.getElementById('prof-overlay').classList.remove('show');}

function activateProfile(prof){
  _prof=prof;
  setCurrentProfile(prof.id);
  /* update header profile bar */
  document.getElementById('pb-em').textContent=prof.emoji||'🕵️';
  document.getElementById('pb-name').textContent=prof.name;
  hideProfileSelector();
  renderSavedList();
  syncNotesUI();
  fullRender();
}

/* PIN overlay for PIN-protected profiles */
function showPinEntry(prof){
  const ov=document.getElementById('pin-overlay');
  document.getElementById('pin-profile-name').textContent=`${prof.emoji||'🕵️'} ${prof.name}`;
  document.getElementById('pin-dots').textContent='——';
  document.getElementById('pin-err').textContent='';
  ov.classList.add('show');
  let entered='';
  function updateDots(){document.getElementById('pin-dots').textContent=entered.length?'●'.repeat(entered.length)+'—'.repeat(Math.max(0,4-entered.length)):'——';}
  function cleanup(){ov.classList.remove('show');ov.replaceWith(ov.cloneNode(true));setupPinOverlay();}
  ov.querySelector('.pin-pad').onclick=e=>{
    const btn=e.target.closest('[data-d]');if(!btn)return;
    const d=btn.dataset.d;
    if(d==='back'){entered=entered.slice(0,-1);updateDots();}
    else if(d==='ok'){
      if(entered===prof.pin){cleanup();activateProfile(prof);}
      else{document.getElementById('pin-err').textContent='Incorrect PIN. Try again.';entered='';updateDots();}
    } else if(entered.length<6){entered+=d;updateDots();}
  };
  document.getElementById('pin-cancel').onclick=cleanup;
}
function setupPinOverlay(){/* re-attach cancel in case of DOM replace */
  const cancel=document.getElementById('pin-cancel');
  if(cancel)cancel.onclick=()=>document.getElementById('pin-overlay').classList.remove('show');
}

/* profile selector events */
document.getElementById('prof-grid').addEventListener('click',e=>{
  /* delete profile */
  const delBtn=e.target.closest('[data-del]');
  if(delBtn){
    e.stopPropagation();
    const pid=delBtn.dataset.del;
    if(confirm('Delete this profile and all its data?')){deleteProfile(pid);showProfileSelector();}
    return;
  }
  /* select profile */
  const card=e.target.closest('[data-pid]');
  if(!card)return;
  const pid=card.dataset.pid;
  const prof=getAllProfiles().find(p=>p.id===pid);
  if(!prof)return;
  if(prof.pin){showPinEntry(prof);}
  else{activateProfile(prof);}
});

document.getElementById('prof-create-btn').addEventListener('click',()=>{
  const name=document.getElementById('prof-name-in').value.trim();
  const emoji=document.getElementById('prof-emoji-in').value;
  const pin=document.getElementById('prof-pin-in')?document.getElementById('prof-pin-in').value.trim():'';
  if(!name){alert('Enter a researcher name.');return;}
  const prof=createProfile(name,emoji,pin);
  activateProfile(prof);
});

/* ── INIT (called by inline disclaimer handler in index.html) ── */
function runInit(){
  /* populate state select */
  const sel=document.getElementById('i-state');
  Object.entries(SN).sort((a,b)=>a[1].localeCompare(b[1])).forEach(([k,v])=>{
    const o=document.createElement('option');
    o.value=k;o.textContent=v;
    sel.appendChild(o);
  });

  /* restore or pick profile */
  const existing=getCurrentProfile();
  if(existing){
    _prof=existing;
    document.getElementById('pb-em').textContent=existing.emoji||'🕵️';
    document.getElementById('pb-name').textContent=existing.name;
    renderSavedList();
    fullRender();
  } else {
    /* no profile yet — show selector */
    document.getElementById('pb-name').textContent='No Profile';
    fullRender();
    showProfileSelector();
  }
  setupPinOverlay();
}

/* ── AUTO-INIT on reload (disclaimer already accepted) ───── */
/* If the user already accepted the disclaimer (localStorage set),
   the inline script hid the overlay but couldn't call runInit()
   because hyve-part2.js wasn't loaded yet. We call it here now. */
(function(){
  if(localStorage.getItem('hyve_sleuth_agreed_v1')==='1'){
    const overlay=document.getElementById('disc-overlay');
    if(overlay)overlay.style.display='none';
    runInit();
  }
})();

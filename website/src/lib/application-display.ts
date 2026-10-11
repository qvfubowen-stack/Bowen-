/**
 * English-only presentation for vehicle/application text.
 *
 * The source workbook contains mixed Chinese names, Latin model codes and
 * engine references in one cell. Public pages must not expose Chinese source
 * labels, while the original row remains untouched in the internal dataset.
 * We translate known automotive names and manufacturing terms, preserve every
 * Latin/number code, and omit unknown Chinese fragments instead of guessing.
 */

const TERMS: ReadonlyArray<readonly [string, string]> = [
  ['适用车型/机型', 'Applications'], ['冷却水管法兰', 'Coolant pipe flange'],
  ['电子节温器总成', 'Electronic thermostat assembly'], ['电子水泵总成', 'Electronic water pump assembly'],
  ['节温器总成', 'Thermostat assembly'], ['节温器芯三件套', 'Thermostat insert kit'],
  ['节温器上盖', 'Thermostat upper housing'], ['节温器盖板', 'Thermostat cover'],
  ['节温器盖密封垫', 'Thermostat cover gasket'], ['电子节温器', 'Electronic thermostat'],
  ['水泵总成', 'Water pump assembly'], ['发动机', 'engine'], ['柴油机', 'diesel engine'],
  ['总成编号', 'Assembly No.'], ['总成OE号', 'Assembly OE No.'], ['总成OE', 'Assembly OE'],
  ['半总成', 'semi-assembly'], ['铝壳总成', 'aluminium housing assembly'],
  ['自动挡', 'automatic transmission'], ['手动', 'manual transmission'], ['自动', 'automatic'],
  ['高压', 'high pressure'], ['低压', 'low pressure'], ['柴油', 'diesel'],
  ['大排量', 'large displacement'], ['小排量', 'small displacement'], ['排量', 'displacement'],
  ['进口', 'imported'], ['原装', 'OE version'], ['内芯', 'insert'], ['芯体', 'insert'], ['芯子', 'insert'],
  ['缸盖', 'cylinder head'], ['水温表', 'temperature gauge'], ['化油器', 'carburettor'],
  ['两插双快速', 'two-pin dual quick connector'], ['两插单快速', 'two-pin single quick connector'],
  ['四插', 'four-pin'], ['两插', 'two-pin'], ['三插', 'three-pin'],
  ['短杆', 'short stem'], ['长杆', 'long stem'], ['弯头', 'elbow'], ['直头', 'straight outlet'],
  ['带尾柄', 'with tail stem'], ['不加电', 'non-electrified'], ['维修', 'service application'],
  ['转向助力', 'power steering'], ['液力缓速器用', 'for hydraulic retarder'],
  ['三厢', 'sedan'], ['旅行版', 'wagon'], ['轿车', 'passenger car'], ['重卡', 'heavy truck'],

  ['阿尔法罗密欧', 'Alfa Romeo'], ['阿尔法罗蜜欧', 'Alfa Romeo'],
  ['上汽通用雪佛兰', 'SAIC-GM Chevrolet'], ['上汽通用别克', 'SAIC-GM Buick'],
  ['北京克莱斯勒', 'Beijing Chrysler'], ['广汽菲克', 'GAC FCA'], ['广汽传祺', 'GAC Trumpchi'],
  ['广汽乘用车', 'GAC Motor'], ['广汽丰田', 'GAC Toyota'], ['一汽丰田', 'FAW Toyota'],
  ['一汽大众', 'FAW-Volkswagen'], ['上汽大众', 'SAIC Volkswagen'], ['一汽奥迪', 'FAW Audi'],
  ['北京现代', 'Beijing Hyundai'], ['悦达起亚', 'Dongfeng Yueda Kia'],
  ['长安福特', 'Changan Ford'], ['上海通用', 'SAIC-GM'], ['通用五菱', 'SAIC-GM-Wuling'],
  ['东风小康', 'Dongfeng Sokon'], ['东风风光', 'Dongfeng Fengguang'],
  ['东风乘用车', 'Dongfeng Passenger Vehicle'], ['东风风神', 'Dongfeng Aeolus'],
  ['东风柳汽', 'Dongfeng Liuzhou Motor'], ['东风风行', 'Dongfeng Forthing'],
  ['沈阳三菱', 'Shenyang Mitsubishi'], ['东安三菱', 'Dongan Mitsubishi'],
  ['绵阳新晨', 'Mianyang Xinchen'], ['沈阳新光', 'Shenyang Xinguang'],
  ['福田康明斯', 'Foton Cummins'], ['上柴', 'SDEC'], ['朝柴', 'Chaoyang Diesel'],
  ['一汽海马', 'FAW Haima'], ['郑州海马', 'Zhengzhou Haima'],
  ['江西五十铃', 'Jiangxi Isuzu'], ['福特全顺', 'Ford Transit'],

  ['沃克斯豪尔', 'Vauxhall'], ['斯柯达', 'Skoda'], ['西雅特', 'SEAT'], ['蓝旗亚', 'Lancia'],
  ['雪铁龙', 'Citroen'], ['标致', 'Peugeot'], ['菲亚特', 'Fiat'], ['欧宝', 'Opel'],
  ['萨博', 'Saab'], ['雷诺', 'Renault'], ['罗孚', 'Rover'], ['塔塔', 'Tata'],
  ['大众', 'Volkswagen'], ['奥迪', 'Audi'], ['宝马迷你', 'BMW MINI'], ['宝马', 'BMW'],
  ['奔驰', 'Mercedes-Benz'], ['保时捷', 'Porsche'], ['宾利', 'Bentley'],
  ['路虎', 'Land Rover'], ['捷豹', 'Jaguar'], ['沃尔沃', 'Volvo'],
  ['别克', 'Buick'], ['雪佛兰', 'Chevrolet'], ['凯迪拉克', 'Cadillac'],
  ['福特', 'Ford'], ['林肯', 'Lincoln'], ['克莱斯勒', 'Chrysler'], ['道奇', 'Dodge'],
  ['吉普', 'Jeep'], ['通用', 'GM'],
  ['丰田', 'Toyota'], ['雷克萨斯', 'Lexus'], ['本田', 'Honda'], ['讴歌', 'Acura'],
  ['日产', 'Nissan'], ['尼桑', 'Nissan'], ['英菲尼迪', 'Infiniti'], ['马自达', 'Mazda'],
  ['三菱', 'Mitsubishi'], ['斯巴鲁', 'Subaru'], ['铃木', 'Suzuki'], ['五十铃', 'Isuzu'],
  ['现代', 'Hyundai'], ['起亚', 'Kia'], ['大宇', 'Daewoo'], ['双龙', 'SsangYong'],
  ['比亚迪', 'BYD'], ['吉利', 'Geely'], ['奇瑞', 'Chery'], ['长城', 'Great Wall'],
  ['哈弗', 'Haval'], ['哈佛', 'Haval'], ['长安', 'Changan'], ['东风', 'Dongfeng'],
  ['一汽', 'FAW'], ['荣威', 'Roewe'], ['名爵', 'MG'], ['大通', 'Maxus'],
  ['传祺', 'Trumpchi'], ['中华', 'Brilliance'], ['江淮', 'JAC'], ['众泰', 'Zotye'],
  ['力帆', 'Lifan'], ['海马', 'Haima'], ['华泰', 'Hawtai'], ['北汽', 'BAIC'],
  ['宝骏', 'Baojun'], ['五菱', 'Wuling'], ['红旗', 'Hongqi'], ['小红旗', 'Hongqi'],
  ['康明斯', 'Cummins'], ['珀金斯', 'Perkins'], ['依维柯', 'Iveco'], ['斯堪尼亚', 'Scania'],
  ['玉柴', 'Yuchai'], ['潍柴', 'Weichai'], ['柳机', 'Liuzhou Engine'], ['东安', 'Dongan'],

  ['新桑塔纳', 'New Santana'], ['桑塔纳时代超人', 'Santana 2000'], ['桑塔纳时代', 'Santana 2000'],
  ['桑塔纳', 'Santana'], ['普桑', 'Santana'], ['新捷达', 'New Jetta'], ['捷达王', 'Jetta King'],
  ['捷达', 'Jetta'], ['新宝来', 'New Bora'], ['宝来', 'Bora'], ['高尔夫', 'Golf'],
  ['新帕萨特', 'New Passat'], ['帕萨特', 'Passat'], ['新朗逸', 'New Lavida'], ['朗逸', 'Lavida'],
  ['新朗行', 'New Gran Lavida'], ['波罗', 'Polo'], ['新波罗', 'New Polo'], ['老波罗', 'Polo'],
  ['途观', 'Tiguan'], ['途安', 'Touran'], ['迈腾', 'Magotan'], ['速腾', 'Sagitar'],
  ['明锐', 'Octavia'], ['昊锐', 'Superb'], ['晶锐', 'Fabia'], ['甲壳虫', 'Beetle'],
  ['尚酷', 'Scirocco'], ['开迪', 'Caddy'],
  ['科鲁兹', 'Cruze'], ['英朗', 'Excelle GT'], ['新英朗', 'New Excelle GT'],
  ['凯越', 'Excelle'], ['新凯越', 'New Excelle'], ['君威', 'Regal'], ['新君威', 'New Regal'],
  ['君越', 'LaCrosse'], ['新君越', 'New LaCrosse'], ['昂科拉', 'Encore'], ['昂科威', 'Envision'],
  ['昂科雷', 'Enclave'], ['赛欧', 'Sail'], ['新赛欧', 'New Sail'], ['乐风', 'Lova'], ['乐骋', 'Aveo'],
  ['爱唯欧', 'Aveo'], ['景程', 'Epica'], ['迈锐宝', 'Malibu'], ['科帕奇', 'Captiva'],
  ['福克斯', 'Focus'], ['蒙迪欧', 'Mondeo'], ['翼虎', 'Kuga'], ['翼博', 'EcoSport'],
  ['锐界', 'Edge'], ['嘉年华', 'Fiesta'], ['穆斯坦', 'Mustang'],
  ['卡罗拉', 'Corolla'], ['花冠', 'Corolla'], ['凯美瑞', 'Camry'], ['普拉多', 'Prado'],
  ['陆地巡洋舰', 'Land Cruiser'], ['锐志', 'Reiz'], ['皇冠', 'Crown'],
  ['雅阁', 'Accord'], ['飞度', 'Fit'], ['思迪', 'City'], ['锋范', 'City'], ['奥德赛', 'Odyssey'],
  ['歌诗图', 'Crosstour'], ['思铂睿', 'Spirior'],
  ['索纳塔', 'Sonata'], ['伊兰特', 'Elantra'], ['途胜', 'Tucson'], ['千里马', 'Accent'],
  ['御翔', 'NF Sonata'], ['瑞纳', 'Verna'], ['赛拉图', 'Cerato'], ['狮跑', 'Sportage'],
  ['轩逸', 'Sylphy'], ['骐达', 'Tiida'], ['颐达', 'Tiida Sedan'], ['逍客', 'Qashqai'],
  ['奇骏', 'X-Trail'], ['天籁', 'Teana'], ['蓝鸟', 'Bluebird'], ['楼兰', 'Murano'],
  ['纳瓦拉', 'Navara'], ['西玛', 'Maxima'],
  ['瑞虎', 'Tiggo'], ['艾瑞泽', 'Arrizo'], ['旗云', 'Cowin'], ['风云', 'Fengyun'],
  ['东方之子', 'Eastar'], ['瑞麟', 'Riich'], ['威麟', 'Rely'],
  ['帝豪', 'Emgrand'], ['博越', 'Boyue'], ['博瑞', 'Borui'], ['金刚', 'King Kong'],
  ['熊猫', 'Panda'], ['远景', 'Vision'], ['全球鹰', 'Gleagle'], ['豪情', 'Haoqing'],
  ['秦', 'Qin'], ['宋', 'Song'], ['唐', 'Tang'], ['元', 'Yuan'], ['汉', 'Han'],
  ['护卫舰', 'Frigate'], ['速锐', 'Surui'], ['思锐', 'Si Rui'],
  ['腾翼', 'Voleex'], ['风骏', 'Wingle'], ['精灵', 'Peri'], ['炫丽', 'Florid'], ['凌傲', 'Voleex C20R'],
  ['瑞风', 'Refine'], ['和悦', 'Heyue'], ['宾悦', 'Binyue'], ['星锐', 'Sunray'],
  ['尊驰', 'Zunchi'], ['菱帅', 'Lancer'], ['菱智', 'Lingzhi'], ['景逸', 'Jingyi'],
  ['风光', 'Fengguang'], ['欧诺', 'Ounuo'], ['悦翔', 'Yuexiang'], ['逸动', 'Eado'],
  ['睿骋', 'Raeton'], ['睿行', 'Ruixing'], ['奔奔', 'Benni'], ['羚羊', 'Lingyang'],
  ['雨燕', 'Swift'], ['天语', 'SX4'], ['奥拓', 'Alto'],
  ['爱丽舍', 'Elysee'], ['富康', 'Fukang'], ['毕加索', 'Picasso'], ['凯旋', 'C-Triomphe'],
  ['帅客', 'Succe'], ['得利卡', 'Delica'], ['帕杰罗', 'Pajero'], ['猎豹', 'Leopaard'],
  ['揽胜运动版', 'Range Rover Sport'], ['揽胜', 'Range Rover'], ['卫士', 'Defender'], ['发现', 'Discovery'],
  ['卡宴', 'Cayenne'], ['欧陆', 'Continental GT'], ['飞驰', 'Flying Spur'],
  ['公羊', 'Ram'], ['大切诺基', 'Grand Cherokee'], ['切诺基', 'Cherokee'], ['指南者', 'Compass'],
];

const SORTED_TERMS = [...TERMS].sort((a, b) => b[0].length - a[0].length);
const HAN_RE = /[\p{Script=Han}]+/gu;
const HAS_HAN_RE = /[\p{Script=Han}]/u;

export function applicationTextEn(raw: string | null | undefined): string {
  const source = String(raw ?? '').trim();
  if (!source) return 'Application not recorded';

  let text = source
    .replace(/[（【]/g, '(')
    .replace(/[）】]/g, ')')
    .replace(/[，、；]/g, ', ')
    .replace(/[：]/g, ': ')
    .replace(/[。]/g, '. ')
    .replace(/[～~]/g, '-');

  for (const [zh, en] of SORTED_TERMS) text = text.split(zh).join(` ${en} `);

  // Unknown Chinese wording is not guessed. Latin model/engine codes and all
  // translated terms remain, so buyers still get useful matching context.
  text = text
    .replace(HAN_RE, ' ')
    .replace(/\s*([,/()])\s*/g, '$1')
    .replace(/\s*:\s*/g, ': ')
    .replace(/\.{2,}/g, '.')
    .replace(/,{2,}/g, ',')
    .replace(/(^|[,(])[-_.]+(?=$|[,.)])/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/^[,./;:\s-]+|[,./;:\s-]+$/g, '')
    .trim();

  return /[A-Za-z0-9]/.test(text) ? text : 'Application details available on request';
}

export function applicationOeText(oeTokens: string[] | null | undefined): string {
  return applicationOeTokens(oeTokens).join('\n');
}

/**
 * OE cells occasionally contain Chinese audit notes or a Chinese-only label.
 * Keep the reference codes, but never expose those workbook notes publicly.
 */
export function applicationOeTokens(oeTokens: string[] | null | undefined): string[] {
  const cleaned = (oeTokens ?? []).flatMap((raw) => {
    let value = String(raw ?? '')
      .replace(/[（【]/g, '(')
      .replace(/[）】]/g, ')')
      // Parenthetical Chinese is an internal note, not part of the OE code.
      .replace(/\([^)]*[\p{Script=Han}][^)]*\)/gu, ' ')
      .replace(/[\p{Script=Han}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^[\s,;:/.-]+|[\s,;:/.-]+$/g, '')
      .trim();

    // Chinese-only labels such as "Assembly OE No." can leave a bare "OE".
    if (!/\d/.test(value)) value = '';
    return value ? [value] : [];
  });

  return [...new Set(cleaned)];
}

export function containsChinese(text: string | null | undefined): boolean {
  return HAS_HAN_RE.test(String(text ?? ''));
}

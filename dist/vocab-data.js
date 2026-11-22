// A curated practice selection from the 2022 compulsory English curriculum.
// The two stages describe the game's difficulty. Examples and prompts are original.
(() => {
  'use strict';

  const spellingVariants = {practice:['practise'], maths:['math']};

  // A second, bilingual cloze for transfer and later reviews.
  const scenes = {
    egg: ['煎蛋时，小心别把蛋壳掉进锅里。', 'Crack one ___ into the pan.'],
    bus: ['你在站牌下等车去动物园。', 'We take the ___ to the zoo.'],
    run: ['小狗追着球飞快地跑。', 'My dog can ___ very fast.'],
    ask: ['你想知道店里的苹果多少钱。', 'May I ___ how much this apple costs?'],
    help: ['同桌找不到笔，请你帮忙。', 'Can you ___ me find my pen?'],
    west: ['傍晚，你指给朋友看太阳落下的方向。', 'The sun sets in the ___.'],
    clock: ['厨房里的钟响了十二下。', 'The kitchen ___ rings at noon.'],
    sing: ['过生日时，大家一起唱歌。', 'Let’s ___ a birthday song.'],
    drink: ['爬山口渴了，你提醒朋友喝水。', 'Stop here and ___ some water.'],
    school: ['暑假结束后，你背上书包返校。', 'We go back to ___ after the summer break.'],
    room: ['住旅馆时，你拿到房间钥匙。', 'This key opens my ___ at the hotel.'],
    eat: ['野餐时，你准备吃一个苹果。', 'I wash my apple before I ___ it.'],
    read: ['在车站，你想读一读站牌上的字。', 'Can you ___ the words on this sign?'],
    speak: ['来了新同学，你想知道他会说什么语言。', 'Do you ___ Chinese?'],
    bread: ['在面包店，你想买一条面包。', 'May I have a loaf of ___?'],
    sleep: ['露营时，大家晚上睡在帐篷里。', 'We ___ in a tent at night.'],
    play: ['棋盘摆好了，你邀请同学下棋。', 'Would you like to ___ chess?'],
    rain: ['刚晾好衣服，外面就下起了雨。', 'Bring the clothes in. The ___ is starting.'],
    count: ['玩捉迷藏时，你闭上眼睛数到十。', 'Close your eyes and ___ to ten.'],
    right: ['找房间时，走廊箭头指向右边。', 'Turn ___ here, not left.'],
    home: ['放学后，你和家人约好在家见。', 'See you at ___ after class.'],
    bike: ['修车时，你发现自行车链条松了。', 'The chain on my ___ is loose.'],
    late: ['电影开场了，你才走进影院。', 'The film has started. We are ___.'],
    safe: ['小猫从车流中获救，现在平安了。', 'The kitten is ___ in my arms now.'],
    mother: ['小鸭子跟着妈妈游过河。', 'The ducklings swim behind their ___.'],
    father: ['照片里的是你爸爸，你是他的孩子。', 'I am his child. He is my ___.'],
    sister: ['你介绍家里刚出生的小妹妹。', 'My parents have a new baby girl. She is my ___.'],
    friend: ['在夏令营，你交到了一个新朋友。', 'I made a new ___ at camp.'],
    park: ['你想去公园的长椅上坐一会儿。', 'Let’s sit on a bench in the ___.'],
    pencil: ['画画前，先削一削铅笔。', 'I sharpen my ___ before I draw.'],
  };

  function group(stage, theme, rows) {
    return rows.map(([word, zh, example, translation, prompt, otherForms = []]) => {
      const aliases = spellingVariants[word] || [];
      const alternatives = otherForms.filter(form => !aliases.includes(form));
      const scene = scenes[word];
      return {word, zh, stage, theme, example, translation, prompt, aliases, alternatives,
        ...(scene ? {scene: {zh: scene[0], prompt: scene[1]}} : {})};
    });
  }

  window.EnglishWords = [
    ...group('primary', '我的教室', [
      ['book', '书', 'My book has a green cover.', '我的书有一个绿色的封面。', 'I read a ___ about a little fox.'],
      ['bag', '包；书包', 'My bag is under my chair.', '我的书包在椅子下面。', 'Put your lunch in your school ___.'],
      ['pen', '钢笔；笔', 'This pen writes in blue ink.', '这支笔写出的是蓝色的字。', 'Please sign your name with this black ___.'],
      ['pencil', '铅笔', 'My pencil has a small eraser on the end.', '我的铅笔末端有一块小橡皮。', 'I use a ___ so I can rub out my lines.'],
      ['ruler', '直尺', 'My ruler is twenty centimetres long.', '我的直尺有二十厘米长。', 'Use a ___ to draw a straight line.'],
      ['desk', '书桌；课桌', 'There are two books on my desk.', '我的书桌上有两本书。', 'I sit at my ___ to do my homework.'],
      ['chair', '椅子', 'This chair has four legs.', '这把椅子有四条腿。', 'Pull up a ___ and sit next to me.'],
      ['door', '门', 'The door to our classroom is blue.', '我们教室的门是蓝色的。', 'Please knock on the ___ before you come in.'],
      ['window', '窗户', 'I can see a tree through the window.', '透过窗户我能看到一棵树。', 'Please open the ___ to let some fresh air in.'],
      ['clock', '钟', 'The clock on the wall shows ten.', '墙上的钟显示十点。', 'Look at the ___ above the door to see the time.']
    ]),
    ...group('primary', '课堂小动作', [
      ['read', '阅读', 'I read a story after lunch.', '午饭后我读一个故事。', 'Can you ___ the words on this page aloud?'],
      ['write', '写', 'I write my name on the first page.', '我在第一页写下自己的名字。', 'Please ___ your answer on the board.'],
      ['draw', '画', 'I draw a cat with a pencil.', '我用铅笔画一只猫。', 'Can you ___ a picture of your house?'],
      ['count', '数数；清点', 'We count the chairs before class.', '上课前我们清点椅子的数量。', 'Please ___ the eggs to see how many we have.'],
      ['open', '打开', 'Please open your book to page ten.', '请把书翻到第十页。', 'The box has a lid; lift it to ___ the box.'],
      ['close', '关上', 'I close my notebook after the lesson.', '课后我合上笔记本。', 'Please ___ the gate so the dog stays inside.', ['shut']],
      ['ask', '问；询问', 'I ask my teacher a question.', '我问老师一个问题。', 'If you need the time, ___ the man with a watch.'],
      ['answer', '回答', 'I can answer this question in English.', '我能用英语回答这个问题。', 'Who can ___ the teacher’s last question?'],
      ['listen', '听；倾听', 'We listen to a song before class.', '上课前我们听一首歌。', 'Please ___ to the bell with your eyes closed.'],
      ['speak', '讲；说（某种语言）', 'We speak English at the club.', '我们在社团里讲英语。', 'My friend can ___ two languages.']
    ]),
    ...group('primary', '家与伙伴', [
      ['mother', '母亲；妈妈', 'My mother and I plant a tree.', '我和妈妈一起种一棵树。', 'My grandma is my dad’s ___.', ['mum', 'mom']],
      ['father', '父亲；爸爸', 'My father makes soup on Sundays.', '我爸爸在星期天做汤。', 'My grandpa is my mum’s ___.', ['dad']],
      ['sister', '姐姐；妹妹', 'My sister and I share a room.', '我和姐姐住在同一个房间。', 'My parents have two children: me and my little ___. She is six.'],
      ['brother', '哥哥；弟弟', 'My brother is two years older than me.', '我哥哥比我大两岁。', 'Ben and I have the same parents. He is my little ___.'],
      ['family', '家庭；家人', 'My family has four people.', '我家有四口人。', 'My parents, my sister and I are one ___.'],
      ['friend', '朋友', 'My friend sits next to me in class.', '我朋友上课时坐在我旁边。', 'Lin is my best ___; we tell each other everything.'],
      ['home', '家', 'I go home after the game.', '比赛结束后我回家。', 'We stayed at ___ and made lunch together.'],
      ['room', '房间', 'My room has a yellow door.', '我的房间有一扇黄色的门。', 'There is a small ___ upstairs with a bed in it.'],
      ['bed', '床', 'My bed is next to the wall.', '我的床靠着墙。', 'At night, I lie down on my ___ and go to sleep.'],
      ['table', '桌子；餐桌', 'Dinner is on the table.', '晚饭摆在餐桌上。', 'Please set the ___ with bowls for dinner.']
    ]),
    ...group('primary', '一日三餐', [
      ['rice', '大米；米饭', 'I eat rice with vegetables.', '我就着蔬菜吃米饭。', 'We cook the little white grains of ___ in a pot.'],
      ['bread', '面包', 'We put cheese on our bread.', '我们把奶酪放在面包上。', 'I need two slices of ___ to make a sandwich.'],
      ['egg', '蛋；鸡蛋', 'I have an egg for breakfast.', '我早餐吃一个鸡蛋。', 'The hen laid one brown ___ this morning.'],
      ['milk', '奶；牛奶', 'There is milk in my cup.', '我的杯子里有牛奶。', 'We get ___ from cows and drink it at breakfast.'],
      ['water', '水', 'I carry water on hot days.', '天热时我会随身带水。', 'Fill the bottle with clean ___ from the tap.'],
      ['apple', '苹果', 'I cut an apple into four pieces.', '我把一个苹果切成四块。', 'I pick a red ___ from the tree and bite into it.'],
      ['banana', '香蕉', 'I put a banana in my lunch box.', '我在饭盒里放了一根香蕉。', 'Peel the yellow ___ before you eat it.'],
      ['orange', '橙子', 'This orange has sweet juice.', '这个橙子的果汁很甜。', 'I cut an ___ in half and squeeze out its juice.'],
      ['fish', '鱼', 'A fish swims below our boat.', '一条鱼在我们的船下游动。', 'This pet has fins and swims in a bowl. It is a ___.'],
      ['chicken', '鸡肉', 'I put chicken in my sandwich.', '我把鸡肉放进三明治里。', 'We make ___ soup with meat from a hen.']
    ]),
    ...group('primary', '上学路上', [
      ['map', '地图', 'I find our town on the map.', '我在地图上找到我们的小镇。', 'The roads on this ___ show how to reach the lake.'],
      ['street', '街道', 'Our street has shops on both sides.', '我们这条街两边都有商店。', 'The baker’s shop is on the same ___ as our house.'],
      ['park', '公园', 'We fly a kite in the park.', '我们在公园里放风筝。', 'The city ___ has trees, benches and a playground.'],
      ['school', '学校', 'Our school has a big playground.', '我们学校有一个大操场。', 'I go to ___ on weekdays to learn with my classmates.'],
      ['bus', '公共汽车', 'I take the bus to school.', '我坐公共汽车上学。', 'The number ten ___ stops here to pick up passengers.'],
      ['bike', '自行车', 'My bike has a little bell.', '我的自行车上有一个小铃铛。', 'I ride my ___ to the shop and ring its bell.', ['bicycle']],
      ['stop', '停下', 'We stop at the red light.', '我们在红灯前停下。', 'When I raise my hand, please ___ walking.'],
      ['left', '左；向左', 'Turn left at the red shop.', '在那家红色的商店向左转。', 'My right hand holds the bag, so I wave with my ___ hand.'],
      ['right', '右；向右', 'The bus turns right at the bank.', '公共汽车在银行处向右转。', 'My left shoe is blue, but my ___ shoe is red.'],
      ['near', '在……附近', 'My home is near the station.', '我家在车站附近。', 'We live ___ the lake, just a short walk away.', ['by']]
    ]),
    ...group('primary', '动起来', [
      ['play', '玩；参加球类运动', 'I play tennis with my sister.', '我和姐姐打网球。', 'We ___ football in the park after class.'],
      ['run', '跑', 'We run around the field.', '我们绕着运动场跑。', 'In the race, I ___ as fast as I can.'],
      ['walk', '走；步行', 'I walk to the library.', '我步行去图书馆。', 'The shop is so close that we can ___ there instead of driving.'],
      ['jump', '跳', 'I can jump over this line.', '我能跳过这条线。', 'Bend your knees and ___ into the air.'],
      ['sing', '唱歌', 'We sing a song for our teacher.', '我们为老师唱一首歌。', 'Can you ___ the words to this song?'],
      ['swim', '游泳', 'We swim in the pool on Fridays.', '我们星期五在泳池里游泳。', 'The duck can ___ across the pond.'],
      ['wash', '洗', 'I wash my hands before lunch.', '午饭前我洗手。', 'Use soap and water to ___ this dirty shirt.'],
      ['eat', '吃', 'We eat soup with bread for lunch.', '我们午饭喝汤、吃面包。', 'I peel the pear before I ___ it.'],
      ['drink', '喝', 'I drink water after football practice.', '踢完球后我喝水。', 'Please ___ this glass of milk slowly.'],
      ['sleep', '睡觉', 'I sleep for eight hours at night.', '我晚上睡八个小时。', 'The baby is tired and needs to ___.']
    ]),
    ...group('junior', '我的学习计划', [
      ['subject', '学科；科目', 'Music is my favourite subject.', '音乐是我最喜欢的学科。', 'Which school ___ do you like best: history or art?'],
      ['lesson', '一节课', 'Our art lesson starts at ten.', '我们的美术课十点开始。', 'We have a music ___ after lunch, from one to two.', ['class']],
      ['science', '科学', 'We grow beans in science class.', '我们在科学课上种豆子。', 'In ___ class, we test which objects float in water.'],
      ['history', '历史', 'In history class, we learn about ancient towns.', '历史课上，我们了解古代城镇。', 'I study ___ to learn how people lived long ago.'],
      ['geography', '地理', 'Our geography teacher shows us a map of Asia.', '地理老师给我们看一张亚洲地图。', 'In ___ class, we find rivers and mountains on maps.'],
      ['maths', '数学', 'We measure shapes in maths class.', '我们在数学课上测量图形。', 'We work with numbers and shapes in ___.', ['math', 'mathematics']],
      ['exam', '考试', 'Our English exam is on Friday.', '我们的英语考试在星期五。', 'I check all my answers before I hand in my ___ paper.', ['examination', 'test']],
      ['question', '问题；问句', 'I have a question about this map.', '关于这张地图，我有一个问题。', '“Where is the station?” is a ___ you can ask.'],
      ['mistake', '错误', 'I find a mistake in my answer.', '我发现自己的答案里有一处错误。', 'I wrote the wrong number, so I need to correct my ___.', ['error']],
      ['practice', '练习（动词）', 'I practice the guitar after dinner.', '晚饭后我练吉他。', 'Let’s ___ saying our new lines before we go on stage.', ['practise']]
    ]),
    ...group('junior', '安排一天', [
      ['early', '早；提早', 'I arrive early to help set up.', '我提前到达，帮忙做准备。', 'Class starts at nine; I arrive ten minutes ___ to get a seat.'],
      ['late', '迟；迟到的', 'I am late for the game.', '我去参加比赛迟到了。', 'The lesson began at eight, so arriving at eight ten made me ___.'],
      ['often', '经常', 'We often play chess after lunch.', '我们经常在午饭后下棋。', 'I ___ visit the library, about four times a week.', ['frequently']],
      ['sometimes', '有时', 'I sometimes take a different road home.', '我有时换一条路回家。', 'I usually have tea, but I ___ have milk instead.', ['occasionally']],
      ['before', '在……之前', 'Please call me before dinner.', '请在晚饭前给我打电话。', 'I put on my socks ___ I put on my shoes.'],
      ['after', '在……之后', 'We clean the room after lunch.', '午饭后我们打扫房间。', 'I put my plate in the sink ___ I finish eating.'],
      ['during', '在……期间', 'We stay quiet during the film.', '看电影期间我们保持安静。', 'We can drink water ___ the break between lessons.'],
      ['minute', '分钟', 'The short game lasts one minute.', '这个小游戏持续一分钟。', 'There are sixty seconds in a ___.'],
      ['hour', '小时', 'It takes one hour to get there.', '到那儿要一个小时。', 'There are sixty minutes in an ___.'],
      ['finish', '完成；做完', 'I finish my homework at six.', '我六点做完作业。', 'I still have one page to read before I ___ this book.', ['complete']]
    ]),
    ...group('junior', '城市导航', [
      ['library', '图书馆', 'I borrow a storybook from the library.', '我从图书馆借了一本故事书。', 'We return our books to the school ___ on Friday.'],
      ['museum', '博物馆', 'The museum has an old fishing boat.', '博物馆里有一条古老的渔船。', 'In the city ___, we look at pots made thousands of years ago.'],
      ['station', '车站', 'My train leaves from this station.', '我的火车从这个车站出发。', 'We wait for the next train at the railway ___.'],
      ['market', '市场；集市', 'We buy fresh fruit at the market.', '我们在市场买新鲜水果。', 'Farmers sell vegetables at the outdoor ___ every Sunday.'],
      ['bridge', '桥', 'This bridge goes over the river.', '这座桥横跨河流。', 'To get to the other bank, walk over the wooden ___.'],
      ['across', '从一边到另一边；横过', 'We walk across the field.', '我们从田野的一边走到另一边。', 'The ferry takes us ___ the river to the opposite bank.'],
      ['north', '北；北方', 'Our map has north at the top.', '我们的地图上方为北。', 'The letter N on this compass stands for ___.'],
      ['south', '南；南方', 'The road runs south from here.', '这条路从这里向南延伸。', 'On a map with north at the top, ___ is at the bottom.'],
      ['east', '东；东方', 'The morning sun is in the east.', '早晨太阳在东方。', 'The letter E on our compass stands for ___.'],
      ['west', '西；西方', 'The farm is west of our town.', '农场在我们镇的西边。', 'Face north and hold out your left hand; it points ___.']
    ]),
    ...group('junior', '和伙伴合作', [
      ['invite', '邀请', 'I invite Lin to my birthday party.', '我邀请小林来参加我的生日派对。', 'Shall we ___ our new classmate to the picnic?'],
      ['borrow', '借入；借来', 'Can I borrow your blue ruler?', '我可以借用你的蓝色直尺吗？', 'May I ___ a pencil from you? I will give it back.'],
      ['lend', '借出；借给', 'I lend my spare pen to Ben.', '我把备用的笔借给本。', 'Could you ___ me your bike until Friday?', ['loan']],
      ['return', '归还', 'I return the ball to its owner.', '我把球还给它的主人。', 'You can borrow my book today; please ___ it to me tomorrow.'],
      ['share', '分享；分用', 'My friend and I share a pizza.', '我和朋友分享一个披萨。', 'One sandwich is enough if we ___ it and each take half.'],
      ['choose', '选择', 'I choose a green card for my team.', '我为队伍选一张绿色卡片。', 'You may ___ one of these three hats to wear.', ['pick', 'select']],
      ['join', '加入', 'I want to join the school band.', '我想加入学校乐队。', 'You can ___ our team and play in the next match.'],
      ['help', '帮助', 'I help my friend carry the boxes.', '我帮朋友搬箱子。', 'This bag is heavy. Can you ___ me lift it?'],
      ['agree', '同意', 'I agree with your idea about the team name.', '我赞同你给队伍起名的想法。', 'We both think the plan is good, so we ___ with each other.'],
      ['explain', '解释；说明', 'Please explain the new rule to me.', '请给我解释一下新规则。', 'I do not understand this word. Can you ___ what it means?']
    ]),
    ...group('junior', '四季出行', [
      ['weather', '天气', 'The weather is warm and sunny today.', '今天天气暖和，阳光明媚。', 'Will it rain on our trip? Let’s check the ___ report.'],
      ['season', '季节', 'My favourite season is spring.', '我最喜欢的季节是春天。', 'Winter is the coldest ___ in our town.'],
      ['spring', '春天', 'We plant these seeds in spring.', '我们在春天种下这些种子。', 'The season between winter and summer is ___.'],
      ['summer', '夏天', 'We go swimming outside in summer.', '我们夏天去户外游泳。', 'The season after spring and before autumn is ___.'],
      ['autumn', '秋天', 'The leaves turn gold in autumn.', '树叶在秋天变成金色。', 'The season between summer and winter is ___.', ['fall']],
      ['winter', '冬天', 'I wear warm gloves in winter.', '我冬天戴保暖手套。', 'The season after autumn and before spring is ___.'],
      ['cloud', '云；云朵', 'A white cloud floats over the hill.', '一朵白云飘过山丘。', 'A dark ___ covers the sun in the sky.'],
      ['wind', '风', 'The wind moves our paper boat.', '风吹动了我们的纸船。', 'The strong ___ blows my hat off.'],
      ['rain', '雨', 'I can hear the rain on the roof.', '我能听到雨打在屋顶上的声音。', 'The ___ falls in drops and makes the path wet.'],
      ['umbrella', '雨伞', 'I carry an umbrella on wet days.', '我在雨天带一把伞。', 'I open my ___ above my head to keep the rain off.']
    ]),
    ...group('junior', '说说自己的状态', [
      ['tired', '累的；疲倦的', 'I feel tired after the long walk.', '走了很长一段路后，我觉得累了。', 'After carrying the boxes all morning, I feel ___ and need a rest.'],
      ['hungry', '饿的', 'I am hungry before dinner.', '晚饭前我饿了。', 'I did not eat breakfast, so now I feel ___.'],
      ['thirsty', '渴的', 'The hot day makes me thirsty.', '炎热的天气让我觉得口渴。', 'My mouth is dry and I need water. I am ___.'],
      ['afraid', '害怕的', 'I am afraid of loud thunder.', '我害怕巨大的雷声。', 'My little sister is ___ of the dark, so I leave a light on.', ['scared']],
      ['proud', '自豪的', 'I am proud of our team.', '我为我们的队伍感到自豪。', 'I made this boat myself, and I feel ___ of my work.'],
      ['ready', '准备好的', 'My bag is packed and I am ready to go.', '我的包收拾好了，我准备好出发了。', 'Is everyone ___ to start? We have all the tools.'],
      ['careful', '小心的；仔细的', 'Be careful with the glass cup.', '拿玻璃杯的时候要小心。', 'The floor is wet. Be ___ not to slip.'],
      ['quiet', '安静的', 'The library is quiet in the morning.', '图书馆早晨很安静。', 'Please be ___ while the baby is sleeping.', ['silent']],
      ['healthy', '健康的', 'Fresh food and sleep help me stay healthy.', '新鲜的食物和睡眠有助于我保持健康。', 'Walking every day helps me keep my body ___.'],
      ['safe', '安全的', 'We feel safe inside during the storm.', '暴风雨时，我们待在屋里觉得安全。', 'Wait until the light turns green and it is ___ to cross.']
    ])
  ];
})();

var config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 305 },
            debug: false
        }
    },
    scene: {
        key: 'scene',
        preload: preload,
        create: create,
        update: update
    }
};

var player;
var stars;
var bombs;
var platforms;
var cursors;
var bombSpeed = 200;
var anihilate = false;
var vx = 0;
var vxmax = 180;
var xacc = 45;
var airFriction = 0.9995;
var groundFriction = 0.8;
var touch = 0.4;
var level = 0;
var score = 0;
var scoreDelta = 10;
var scoreDecay = 0.99;
var initDecay = 100;
var decay = initDecay;
var scoreText;
var deltaText;
var pausedText;
var lucaText;
var timed;
var timer2;
var keyP;
var keyR;
var grace = false;
var graced;
var gameOver = false;

var game = new Phaser.Game(config);

function preload ()
{
    this.load.crossOrigin = "Anonymous";
    this.load.image('sky', cdn + '/images/sky.png');
    this.load.image('ground', cdn + '/images/platform.png');
    this.load.image('star', cdn + '/images/star.png');
    this.load.image('bomb', cdn + '/images/bomb.png');
    this.load.spritesheet('dude', cdn + '/images/dude.png', { frameWidth: 32, frameHeight: 48 });
}

function create ()
{
    //  A simple background for our game
    this.add.image(400, 300, 'sky');

    //  The platforms group contains the ground and the 2 ledges we can jump on
    platforms = this.physics.add.staticGroup();

    //  Here we create the ground.
    //  Scale it to fit the width of the game (the original sprite is 400x32 in size)
    platforms.create(400, 568, 'ground').setScale(2).refreshBody();

    //  Now let's create some ledges
    platforms.create(750, 220, 'ground');
    platforms.create(50, 280, 'ground');
    platforms.create(600, 400, 'ground');
    // platforms.create(120, 120, 'ground');

    // The player and its settings
    player = this.physics.add.sprite(100, 450, 'dude');

    //  Player physics properties. Give the little guy a slight bounce.
    player.setBounce(0.1);
    player.setCollideWorldBounds(true);

    //  Our player animations, turning, walking left and walking right.
    this.anims.create({
        key: 'left',
        frames: this.anims.generateFrameNumbers('dude', { start: 0, end: 3 }),
        frameRate: 10,
        repeat: -1
    });

    this.anims.create({
        key: 'turn',
        frames: [ { key: 'dude', frame: 4 } ],
        frameRate: 20
    });

    this.anims.create({
        key: 'right',
        frames: this.anims.generateFrameNumbers('dude', { start: 5, end: 8 }),
        frameRate: 10,
        repeat: -1
    });

    //  Input Events
    cursors = this.input.keyboard.createCursorKeys();

    //  Some stars to collect, 12 in total, evenly spaced 70 pixels apart along the x axis
    stars = this.physics.add.group({
        key: 'star',
        repeat: 11,
        setXY: { x: 12, y: 20, stepX: 70 }
    });

    stars.children.iterate(function (child) {

        //  Give each star a slightly different bounce
        child.setBounceY(Phaser.Math.FloatBetween(0.4, 0.8));
        // child.setCollideWorldBounds(true);

    });

    bombs = this.physics.add.group();

    //  Collide the player and the stars with the platforms
    this.physics.add.collider(player, platforms);
    this.physics.add.collider(stars, platforms);
    this.physics.add.collider(bombs, platforms);
    // bombs & stars
    // this.physics.add.collider(bombs, stars);
    this.physics.add.collider(bombs, bombs, anihilateBombs, null, this);

    //  Checks to see if the player overlaps with any of the stars, if he does call the collectStar function
    this.physics.add.overlap(player, stars, collectStar, null, this);

    this.physics.add.collider(player, bombs, hitBomb, null, this);

    // Timer to update some texts on screen
    timed = this.time.addEvent({ delay: 1000, callback: updateTime, loop: true });

    // To pause: type P, to restart after end: R
    keyP = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    keyR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R)

    //  Some texts
    scoreText = this.add.text(16, 16, 'score: 0', { fontSize: '32px Courier', fill: '#00ff00' });
    deltaText = this.add.text(600, 16, ['delta: ' + scoreDelta, 'level: 0'], { fontSize: '16px Courier', fill: '#0000ff' });
    pausedText = this.add.text(300, 250, '', { fontSize: '64px Courier', fill: '#888888' });
    lucaText = this.add.text(250, 250, 'Hallo ' + user + '!', { fontSize: '64px Courier', fill: '#888888' });
    timer2 = this.time.addEvent({ delay: 1500, callback: delLuca });
}

function update ()
{
    if (gameOver)
    {
        if (keyR.isDown) {
            lucaText.setText('');
            vx = 0;
            level = 0;
            score = 0;
            scoreDelta = 10;
            decay = initDecay;
            gameOver = false;
            this.scene.start();
            // this.physics.resume();
        } else {
            scoreText.setText('Your score: ' + Math.round(score));
            lucaText.setText('Restart: R');
        }
        return;
    }

    if (keyP.isDown && !grace) {
        // When pausing: add a grace period, to not toggle too often
        grace = true;
        graced = this.time.addEvent({ delay: 500, callback: updateGrace });

        game.paused = !game.paused;
        if (game.paused) {
            this.physics.pause();
            pausedText.setText('Paused...');
        } else {
            this.physics.resume();
            pausedText.setText('');
        }
    }

    if (game.paused) {
        return;
    }

    // Every update step lower score delta
    if (--decay <= 0) {
        scoreDelta *= scoreDecay;
        decay = initDecay;
    }

    // Moving
    if ((player.body.touching.left && vx < 0)
        || (player.body.touching.right && vx > 0)) {
            vx *= touch;
    } else {
        vx *= airFriction;
    }

    if (player.body.touching.down) {

        vx *= groundFriction;

        if (cursors.left.isDown)
        {
            vx = vx - xacc;
            vx = Math.max(-vxmax, vx);
            player.anims.play('left', true);
        }
        else if (cursors.right.isDown)
        {
            vx = vx + xacc;
            vx = Math.min(vxmax, vx);
            player.anims.play('right', true);
        }
        else
        {
            player.anims.play('turn');
        }

        if (cursors.up.isDown)
        {
            player.setVelocityY(-330);
        }
    }
    player.setVelocityX(vx);

    // Rotate bombs
    bombs.children.iterate(function (bomb) {
        bomb.rotation += 0.03;
    });
}

function updateGrace() {
    grace = false;
}

function delLuca() {
    lucaText.setText('');
}

function collectStar (player, star)
{
    star.disableBody(true, true);

    //  Add and update the score
    score += scoreDelta;
    scoreText.setText('Score: ' + Math.round(score));

    if (stars.countActive(true) === 0)
    {
        //  A new batch of stars to collect
        stars.children.iterate(function (child) {
            child.enableBody(true, child.x, 0, true, true);
        });

        scoreDelta *= 2;
        level += 1;

        var x = (player.x < 400) ? Phaser.Math.Between(400, 800) : Phaser.Math.Between(0, 400);

        var bomb = bombs.create(x, 36, 'bomb');
        // bomb.mass = 100;
        bomb.setBounce(1);
        bomb.setCollideWorldBounds(true);
        bomb.setVelocity(Phaser.Math.Between(-bombSpeed, bombSpeed), 5);
        // bomb.allowGravity = false;

    }
}

function hitBomb (player, bomb)
{
    this.physics.pause();

    player.setTint(0xff0000);
    bomb.setTint(0xff0000);

    player.anims.play('turn');

    gameOver = true;
}

function anihilateBombs(bomb1, bomb2)
{
    if (anihilate) {
        bomb1.disableBody(true, true);
        bomb2.disableBody(true, true);
    }
}

function updateTime()
{
    sd = 'delta: ' + scoreDelta;
    le = 'level: ' + level;
    deltaText.setText([sd.substr(0, 14), le])
}
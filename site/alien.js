"use strict";

// alien.js

const g = {};

( function () {

	window.addEventListener( "DOMContentLoaded", init );

	function init() {

		g.levelNames = [ "ART", "BED", "CAT", "DOG", "EYE", "FOX", "GEM", "HAT" ];

		// Load user data from local storage.
		g.userData = JSON.parse( localStorage.getItem( "alien" ) );
		if( !g.userData ) {
			g.userData = {
				"player": "p1",
			};
		}
		let lastLevel = null;
		for( let i = 0; i < g.levelNames.length; i++ ) {
			if( !g.userData[ g.levelNames[ i ] ] ) {
				g.userData[ g.levelNames[ i ] ] = {
					"locked": true,
					"stars": 0,
					"nextLevel": null
				};
				if( lastLevel ) {
					g.userData[ lastLevel].nextLevel = g.levelNames[ i ];
				}
			}
			lastLevel = g.levelNames[ i ];
		}

		// First level should always be unlocked.
		g.userData[ g.levelNames[ 0 ] ].locked = false;

		// Set up the screen scale.
		g.scale = { "aspect": 4 / 3, "x": 1, "y": 1, "width": 800, "height": 600 };

		// Set up the game state.
		g.completeLevel = function completeLevel( name, stars ) {
			const level = g.userData[ name ];
			const nextLevel = g.userData[ level.nextLevel ];

			// Unlock the next level.
			if( nextLevel ) {
				nextLevel.locked = false;
				nextLevel.stars = Math.max( nextLevel.stars, stars );
			}
			g.saveUserData();
		};

		g.saveUserData = function saveUserData() {
			localStorage.setItem( "alien", JSON.stringify( g.userData ) );
		}

		// Create the PIXI application.
		g.app = new PIXI.Application( {
			"backgroundColor": "#5E3F6B",
			"resizeTo": window
		} );
		document.body.appendChild( g.app.view );

		// Resize the PIXI application.
		window.addEventListener( "resize", resize );
		resize();
		g.initUI();
		g.showLoadingScreen();

		// Load the sounds
		g.sounds = {
			"jump": loadSound( "assets/sounds/jump.wav", 0.3 ),
			"pickup": loadSound( "assets/sounds/pickup.wav", 0.6 ),
			"letter": loadSound( "assets/sounds/letter.wav", 0.3, 1.5 ),
			"open": loadSound( "assets/sounds/open-door.ogg", 0.6 ),
			"win": loadSound( "assets/sounds/win.mp3", 0.6 ),
			"explosion": loadSound( "assets/sounds/explosion.wav", 0.3 ),
			"explosion2": loadSound( "assets/sounds/explosion2.wav", 0.3 ),
			"enemyHit": loadSound( "assets/sounds/enemy-hit.wav", 0.6 ),
			"playerHit": loadSound( "assets/sounds/player-hit.wav", 0.6 ),
			"walk1": loadSound( "assets/sounds/walk1.wav", 0.25 ),
			"walk2": loadSound( "assets/sounds/walk2.wav", 0.25 ),
			"land": loadSound( "assets/sounds/walk2.wav", 0.25 ),
			"throw": loadSound( "assets/sounds/throw.wav", 0.4 ),
			"lose": loadSound( "assets/sounds/lose.ogg", 1 ),
			"intro": loadSound( "assets/sounds/intro.ogg", 0.6 ),
			"click": loadSound( "assets/sounds/click.wav", 0.2 ),
		};

		// Load the assets
		( async () => {
			const backgroundPromise = PIXI.Assets.load( "assets/backgrounds.json" );
			const uiPromise = PIXI.Assets.load( "assets/ui.json" );
			const spritesheetPromise = PIXI.Assets.load( "assets/spritesheet.json" );

			// Create the title screen.
			const titleScreenPromise = PIXI.Assets.load( "assets/images/alien_title.png" );

			// Create the background.
			g.backgrounds = await backgroundPromise;
			g.background = new PIXI.TilingSprite(
				g.backgrounds.textures[ "bg_purple.png" ], g.app.screen.width, g.app.screen.height
			);
			g.app.stage.addChildAt( g.background, 0 );

			// Create the title screen container
			g.titleScreenContainer = new PIXI.Container();
			g.app.stage.addChild( g.titleScreenContainer );

			// Resize the background.
			resize();

			// Create the UI.
			g.uiSprites = await uiPromise;

			// Create the spritesheet.
			g.spritesheet = await spritesheetPromise;

			// Create the title screen.
			g.titleScreen = await titleScreenPromise;

			// Show the title screen.
			//g.hideLoadingScreen( showTitleScreen );
			g.hideLoadingScreen( g.showLevelSelectionScreen );

		} )();
	}

	function showTitleScreen() {

		const titleScreen = new PIXI.Sprite( g.titleScreen );
		titleScreen.anchor.set( 0.5, 0.5 );
		titleScreen.x = 400;
		titleScreen.y = 300;
		g.titleScreenContainer.addChild( titleScreen );

		// Create play button that can be used to trigger the video
		//const buttonContainer = new PIXI.Container();
		const button = new PIXI.Graphics()
			.beginFill( "#000000", 0.5 )
			.drawRoundedRect( 0, 0, 100, 100, 10 )
			.endFill()
			.beginFill( "#ffffff" )
			.moveTo( 36, 30 )
			.lineTo( 36, 70 )
			.lineTo( 70, 50 );

		// Position the button
		button.x = 350;
		button.y = 400;

		// Enable interactivity on the button
		button.eventMode = "static";
		button.cursor = "pointer";

		// Add to the stage
		g.titleScreenContainer.addChild( button );

		// Listen for click events
		button.on( "pointertap", function () {

			button.destroy();
			//titleScreen.destroy();

			// Play the video
			const video = PIXI.Texture.from( "assets/videos/alien_video.mp4" );

			// Create the video sprite
			const videoSprite = new PIXI.Sprite( video );
			videoSprite.x = 0;
			videoSprite.y = 0;
			videoSprite.width = 800;
			videoSprite.height = 600;
			g.titleScreenContainer.addChild( videoSprite );

			// Show level selection screen when the video ends
			setTimeout( function () {
				videoSprite.destroy();
				g.titleScreenContainer.destroy();
				g.showLevelSelectionScreen();
			}, 12000 );
		} );
	}

	function resize() {
		g.app.renderer.resize( window.innerWidth, window.innerHeight );
		if ( window.innerWidth / window.innerHeight >= g.scale.aspect ) {
			g.scale.x = window.innerHeight * g.scale.aspect / g.scale.width;
			g.scale.y = window.innerHeight / g.scale.height;
		} else {
			g.scale.x = window.innerWidth / g.scale.width;
			g.scale.y = window.innerWidth / g.scale.aspect / g.scale.height;
		}
		g.app.stage.scale.x = g.scale.x;
		g.app.stage.scale.y = g.scale.y;
		if( g.background ) {
			g.background.width = g.app.screen.width / g.scale.x;
			g.background.height = g.app.screen.height / g.scale.y;
		}
		if( g.titleScreenContainer ) {
			let pos = g.app.stage.toLocal(
				new PIXI.Point( g.app.screen.width / 2, g.app.screen.height / 2 )
			);
			g.titleScreenContainer.x = pos.x - 400;
			g.titleScreenContainer.y = pos.y - 300;
		}
		g.resizeGame();
		g.resizeUi();
	}

	function loadSound( src, volume, rate ) {
		if( rate === undefined ) {
			rate = 1;
		}
		return new Howl( {
			"src": [ src ], "autoplay": false, "loop": false, "volume": volume, "rate": rate
		} );
	}

} )();

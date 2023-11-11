"use strict";

// alien.js

const g = {};

( function () {

	window.addEventListener( "DOMContentLoaded", init );

	function init() {

		g.scale = { "aspect": 4 / 3, "x": 1, "y": 1, "width": 800, "height": 600 };

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

		// Load the assets
		( async () => {
			const backgroundPromise = PIXI.Assets.load( "assets/backgrounds.json" );
			const uiPromise = PIXI.Assets.load( "assets/ui.json" );
			const spritesheetPromise = PIXI.Assets.load( "assets/spritesheet.json" );

			// Create the background.
			g.backgrounds = await backgroundPromise;
			g.background = new PIXI.TilingSprite(
				g.backgrounds.textures[ "bg_purple.png" ], g.app.screen.width, g.app.screen.height
			);
			g.app.stage.addChildAt( g.background, 0 );

			// Resize the background.
			resize();

			// Create the UI.
			g.uiSprites = await uiPromise;

			// Create the spritesheet.
			g.spritesheet = await spritesheetPromise;

			// Show the title screen.
			g.hideLoadingScreen( g.showTitleScreen );
		} )();
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
		g.resizeGame();
	}

} )();

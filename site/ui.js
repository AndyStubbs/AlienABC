"use strict";

( function () {
	const ui = {
		"fadeItems": [],
		"action": () => {},
		"buttons": [],
		"buttonsActive": false,
		"container": null,
		"loadingScreen": null,
		"titleScreen": null,
		"p1Button": null,
		"p2Button": null,
		"p3Button": null
	};

	g.initUI = function () {
		// Create the UI Container.
		ui.container = new PIXI.Container();
		g.app.stage.addChild( ui.container );
		createLoadingScreen();
	};

	g.showLoadingScreen = function () {
		ui.loadingScreen.container.visible = true;
		ui.loadingScreen.container.alpha = 0;
		ui.fadeItems.push( ui.loadingScreen.container );
		ui.action = () => {
			g.app.ticker.add( runLoadingScreen );
		};
		g.app.ticker.add( runFadeIn );
	};

	g.hideLoadingScreen = function ( action ) {
		ui.fadeItems.push( ui.loadingScreen.container );
		ui.action = action;
		g.app.ticker.remove( runFadeIn );
		g.app.ticker.remove( runLoadingScreen );
		g.app.ticker.add( runFadeOut );
	};

	g.showLevelSelectionScreen = function () {
		if( !ui.titleScreen ) {
			createLevelSelectionScreen();
		}
		ui.buttonsActive = true;
		ui.titleScreen.container.visible = true;
		ui.titleScreen.container.alpha = 0;
		ui.fadeItems = [ ui.titleScreen.container ];
		ui.action = () => {};
		g.app.ticker.add( runFadeIn );

		// Unlock the levels.
		unlockLevels();
	};

	g.resizeUi = function resizeUi() {
		if( ui.titleScreen ) {
			let pos = g.app.stage.toLocal(
				new PIXI.Point( g.app.screen.width / 2, 0 )
			);
			ui.titleScreen.titleText.x = pos.x;
			ui.titleScreen.titleText.y = pos.y + 34;
			pos = g.app.stage.toLocal(
				new PIXI.Point( g.app.screen.width / 2, g.app.screen.height / 2 )
			);
			ui.panel.x = pos.x - 275;
			ui.panel.y = pos.y - 125;

			pos = g.app.stage.toLocal(
				new PIXI.Point( 0, g.app.screen.height / 2 )
			);

			ui.p1Button.x = pos.x + 15;
			ui.p1Button.y = pos.y - 100;
			ui.p2Button.x = pos.x + 15;
			ui.p2Button.y = pos.y;
			ui.p3Button.x = pos.x + 15;
			ui.p3Button.y = pos.y + 100;
		}
	};

	function createLoadingScreen() {
		ui.loadingScreen = {};
		ui.loadingScreen.container = new PIXI.Container();
		ui.loadingScreen.loadingText = new PIXI.Text( "Loading...", {
			"fontFamily": "Arial",
			"fontSize": 36,
			"fill": "#ffffff",
			"stroke": "#000000",
			"strokeThickness": 3,
			"dropShadow": true,
			"dropShadowColor": "#000000",
			"dropShadowBlur": 4,
			"align": "center"
		} );
		ui.loadingScreen.loadingText.anchor.set( 0.5, 0.5 );
		const pos = g.app.stage.toLocal(
			new PIXI.Point( g.app.screen.width / 2, g.app.screen.height / 2 )
		);
		ui.loadingScreen.loadingText.x = pos.x;
		ui.loadingScreen.loadingText.y = pos.y;
		ui.loadingScreen.container.addChild( ui.loadingScreen.loadingText );
		ui.loadingScreen.container.visible = false;
		ui.container.addChild( ui.loadingScreen.container );
	}

	function createLevelSelectionScreen() {
		ui.titleScreen = {};
		ui.titleScreen.container = new PIXI.Container();
		ui.titleScreen.container.visible = false;
		ui.container.addChild( ui.titleScreen.container );

		// Create the title text.
		ui.titleScreen.titleText = new PIXI.Text( "Alien ABC", {
			"fontFamily": "Arial",
			"fontSize": 72,
			"fill": "#ffffff",
			"stroke": "#000000",
			"strokeThickness": 3,
			"dropShadow": true,
			"dropShadowColor": "#000000",
			"dropShadowBlur": 4,
			"align": "center"
		} );
		ui.titleScreen.titleText.anchor.set( 0.5, 0 );
		let pos = g.app.stage.toLocal(
			new PIXI.Point( g.app.screen.width / 2, 0 )
		);
		ui.titleScreen.titleText.x = pos.x;
		ui.titleScreen.titleText.y = pos.y + 34;
		ui.titleScreen.container.addChild( ui.titleScreen.titleText );

		// Create the level selection panel.
		ui.titleScreen.levelSelectionPanel = new PIXI.Container();
		ui.titleScreen.container.addChild( ui.titleScreen.levelSelectionPanel );
		const panelWidth = 550;
		const panelHeight = 350;
		const panel = new PIXI.Graphics();
		panel.beginFill( "#000000", 0.5 );
		panel.drawRect( 0, 0, panelWidth, panelHeight );
		panel.endFill();
		pos = g.app.stage.toLocal(
			new PIXI.Point( g.app.screen.width / 2, g.app.screen.height / 2 )
		);
		panel.x = pos.x - panelWidth / 2;
		panel.y = pos.y - panelHeight / 2 + 40;
		ui.titleScreen.levelSelectionPanel.addChild( panel );
		ui.panel = panel;

		// Create the level buttons.
		const buttons = g.levelNames.slice( 0, 9 );
		let x = 80;
		let y = 90;
		buttons.forEach( button => {
			const levelButton = createButton( button, x, y, () => {
				g.hideTitleScreen( () => {
					g.showLevel( button.toLowerCase() );
				} );
			} );
			panel.addChild( levelButton );
			x += 130;
			if( x > panelWidth - 80 ) {
				x = 80;
				y += 150;
			}
		} );

		// Create the player selection animation.
		ui.p1Button = createPlayerSelectionButton( "p1", -100 );
		ui.p2Button = createPlayerSelectionButton( "p2", 0 );
		ui.p3Button = createPlayerSelectionButton( "p3", 100 );
	}

	function createPlayerSelectionButton( player, y ) {

		const panel = g.userData.player === player ? "green_panel.png" : "grey_panel.png";

		// Create the button
		const button = new PIXI.Sprite( g.uiSprites.textures[ panel ] );
		button.anchor.set( 0, 0 );
		let pos = g.app.stage.toLocal(
			new PIXI.Point( 0, g.app.screen.height / 2 )
		);
		button.x = pos.x + 15;
		button.y = pos.y + y;
		button.tint = "#454545";

		// Create the animation
		const frames = [];
		for( let i = 1; i <= 10; i++ ) {
			frames.push( g.spritesheet.textures[ player + "_front.png" ] );
		}
		frames.push( g.spritesheet.textures[ player + "_blink.png" ] );
		const playerAnimation = new PIXI.AnimatedSprite( frames );
		playerAnimation.anchor.set( 0.5, 0.5 );
		playerAnimation.x = 49;
		playerAnimation.y = 48;
		playerAnimation.animationSpeed = 0.1;
		setTimeout( () => {
			playerAnimation.play();
		}, Math.random() * 2000 );
		button.addChild( playerAnimation );

		// Create the player selection
		ui.titleScreen.container.addChild( button );

		// Create the button
		button.interactive = true;
		button.on( "pointerover", () => {
			button.tint = "#565656";
		} );
		button.on( "pointerout", () => {
			button.tint = "#454545";
		} );
		button.on( "pointerdown", () => {
			if( g.sounds ) {
				g.sounds.click.play();
			}
			g.userData.player = player;
			g.saveUserData();
			ui.p1Button.texture = g.uiSprites.textures[ "grey_panel.png" ];
			ui.p2Button.texture = g.uiSprites.textures[ "grey_panel.png" ];
			ui.p3Button.texture = g.uiSprites.textures[ "grey_panel.png" ];
			button.texture = g.uiSprites.textures[ "green_panel.png" ];
		} );

		return button;
	}

	function createButton( text, x, y ) {

		const button = new PIXI.Sprite( g.uiSprites.textures[ "blue_panel.png" ] );
		button.anchor.set( 0.5, 0.5 );
		button.x = x;
		button.y = y;
		button.interactive = true;

		// Create the background image
		const background = new PIXI.Sprite( g.uiSprites.textures[ text.toLowerCase() + ".png" ] );
		background.anchor.set( 0.5, 0.5 );
		background.scale.set( 0.65, 0.65 );
		background.x = 0;
		background.y = 0;
		button.addChild( background );
		
		const buttonText = new PIXI.Text( text, {
			"fontFamily": "Arial",
			"fontSize": 24,
			"fill": "#ffffff",
			"stroke": "#000000",
			"strokeThickness": 3,
			"dropShadow": true,
			"dropShadowColor": "#000000",
			"dropShadowBlur": 4,
			"align": "center"
		} );
		buttonText.anchor.set( 0.5, 0.5 );
		buttonText.x = 0;
		buttonText.y = 70;
		button.addChild( buttonText );

		// Create the lock image
		const lock = new PIXI.Sprite( g.spritesheet.textures[ "lock_yellow.png" ] );
		lock.anchor.set( 0.5, 0.5 );
		lock.x = 0;
		lock.y = 0;
		//lock.visible = false;
		button.addChild( lock );
		button.lockImage = lock;

		ui.buttons.push( button );

		button.levelName = text;

		return button;
	}

	function unlockLevels() {
		ui.buttons.forEach( button => {
			if( !g.userData[ button.levelName ].locked ) {
				unlockLevel( button );
			}
		} );
	}

	function unlockLevel( button ) {
		button.on( "pointerover", () => {
			button.tint = "#aaaaaa";
		} );
		button.on( "pointerout", () => {
			button.tint = "#ffffff";
		} );
		button.on( "pointerdown", () => {
			button.tint = "#ffffff";
			startLevel( button.levelName );
		} );
		button.lockImage.visible = false;
	}

	function runFadeOut( delta ) {
		let fadeOutComplete = true;
		ui.fadeItems.forEach( item => {
			item.alpha = Math.max( 0, item.alpha - ( delta * 0.02 ) );
			if( item.alpha > 0 ) {
				fadeOutComplete = false;
			} else {
				item.visible = false;
			}
		} );
		if( fadeOutComplete ) {
			g.app.ticker.remove( runFadeOut );
			const action = ui.action;
			ui.action = () => {};
			ui.fadeItems = [];
			action();
		}
	}

	function runFadeIn( delta ) {
		let fadeInComplete = true;
		ui.fadeItems.forEach( item => {
			item.alpha = Math.min( 1, item.alpha + ( delta * 0.02 ) );
			if( item.alpha < 1 ) {
				fadeInComplete = false;
			}
		} );
		if( fadeInComplete ) {
			g.app.ticker.remove( runFadeIn );
			const action = ui.action;
			ui.action = () => {};
			ui.fadeItems = [];
			action();
		}
	}

	function runLoadingScreen() {
		const dots = Math.floor( g.app.ticker.lastTime / 200 ) % 4;
		const text = "Loading" + ".".repeat( dots ) + " ".repeat( 3 - dots );
		ui.loadingScreen.loadingText.text = text;
	}

	function startLevel( name ) {
		if( !ui.buttonsActive ) {
			return;
		}
		g.sounds.click.play();
		ui.buttonsActive = false;
		g.loadLevel( name );
		ui.fadeItems = [ ui.titleScreen.container ];
		ui.action = () => {
			const stars = g.userData[ name ].stars;
			g.startLevel( stars );
		};
		g.app.ticker.remove( runFadeIn );
		g.app.ticker.remove( runLoadingScreen );
		g.app.ticker.add( runFadeOut );
	}

} )();

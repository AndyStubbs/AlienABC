"use strict";

( function () {
	const ui = {
		"fadeItems": [],
		"action": () => {}
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

	g.showTitleScreen = function () {
		if( !ui.titleScreen ) {
			createTitleScreen();
		}
		ui.buttonsActive = true;
		ui.titleScreen.container.visible = true;
		ui.titleScreen.container.alpha = 0;
		ui.fadeItems = [ ui.titleScreen.container ];
		ui.action = () => {};
		g.app.ticker.add( runFadeIn );
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

	function createTitleScreen() {
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
		ui.titleScreen.titleText.anchor.set( 0.5, 0.5 );
		let pos = g.app.stage.toLocal(
			new PIXI.Point( g.app.screen.width / 2, 100 )
		);
		ui.titleScreen.titleText.x = pos.x;
		ui.titleScreen.titleText.y = pos.y;
		ui.titleScreen.container.addChild( ui.titleScreen.titleText );

		// Create the level selection panel.
		ui.titleScreen.levelSelectionPanel = new PIXI.Container();
		ui.titleScreen.container.addChild( ui.titleScreen.levelSelectionPanel );
		const panelWidth = 600;
		const panelHeight = 400;
		const panel = new PIXI.Graphics();
		panel.beginFill( "#000000", 0.5 );
		panel.drawRect( 0, 0, panelWidth, panelHeight );
		panel.endFill();
		pos = g.app.stage.toLocal(
			new PIXI.Point( g.app.screen.width / 2, g.app.screen.height / 2 )
		);
		panel.x = pos.x - panelWidth / 2;
		panel.y = pos.y - panelHeight / 2;
		ui.titleScreen.levelSelectionPanel.addChild( panel );

		// Create the level selection text.
		const levelSelectionText = new PIXI.Text( "Select a level", {
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
		panel.addChild( levelSelectionText );
		levelSelectionText.anchor.set( 0.5, 0.5 );
		levelSelectionText.x = panelWidth / 2;
		levelSelectionText.y = 35;

		// Create the level buttons.
		const buttons = [ "ART", "BED", "CAT", "DOG", "EYE", "FOX", "GEM", "HAT", //"IMP", "JET", 
			//"KID", "LAM", "MOB", "NUN", "OWL", "PIG", "QUE", "RAT", "SUN", "TUB", "URN", "VAN",
			//"WAX", "XEN", "YAK", "ZOO" 
		];
		let x = 100;
		let y = 125;
		buttons.forEach( button => {
			const levelButton = createButton( button, x, y, () => {
				g.hideTitleScreen( () => {
					g.showLevel( button.toLowerCase() );
				} );
			} );
			panel.addChild( levelButton );
			x += 130;
			if( x > panelWidth - 100 ) {
				x = 100;
				y += 150;
			}
		} );
	}

	function createButton( text, x, y ) {
		const button = new PIXI.Sprite( g.uiSprites.textures[ "blue_panel.png" ] );
		button.anchor.set( 0.5, 0.5 );
		button.x = x;
		button.y = y;
		button.interactive = true;
		button.on( "pointerover", () => {
			button.tint = "#aaaaaa";
		} );
		button.on( "pointerout", () => {
			button.tint = "#ffffff";
		} );
		button.on( "pointerdown", () => startLevel( text ) );
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
		return button;
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
		ui.buttonsActive = false;
		g.loadLevel( name );
		ui.fadeItems = [ ui.titleScreen.container ];
		ui.action = () => {
			g.startLevel();
		};
		g.app.ticker.remove( runFadeIn );
		g.app.ticker.remove( runLoadingScreen );
		g.app.ticker.add( runFadeOut );
	}

} )();

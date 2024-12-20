"use strict";

( function () {

	let game = {};
	let startingStars = 0;

	const FADE_IN_SPEED = 0.03;
	const FADE_OUT_SPEED = 0.03;
	const DEAD_BODY_FADE_START = 100;
	const HURT_ANIMATION_DURATION = 10;
	const IDLE_ANIMATION_START = 200;
	const THROW_COOLDOWN = 20;
	const THROW_ANIMATION_DURATION = 15;
	const MAX_VELOCITY_Y_FOR_GROUNDED = 2.5;
	const GRAVITY_SCALE = 0.0007;
	const JUMP_FORCE = 0.12;
	const HIT_FORCE = 0.05;
	const DEBUG = false;
	const SHOW_FPS = false;
	const MIDDLE_LAYER = "Middle 1";
	const enemies = {
		"Slime": {
			"health": 10,
			"damage": 10,
			"speed": -1,
			"bodyWidthModifier": 0.8,
			"animationsData": [
				"stand", "slimeWalk1.png", 0, 0,
				"front", "slimeWalk1.png", 0, 0,
				"jump", "slimeWalk1.png", 0, 0,
				"walk", "slimeWalk", 2, 0.05,
				"hurt", "slimeWalk1.png", 0, 0,
				"dead", "slimeDead.png", 0, 0,
			]
		},
		"Snail": {
			"health": 60,
			"damage": 20,
			"speed": -0.5,
			"bodyWidthModifier": 0.9,
			"animationsData": [
				"stand", "snailWalk1.png", 0, 0,
				"front", "snailWalk1.png", 0, 0,
				"jump", "snailWalk1.png", 0, 0,
				"walk", "snailWalk", 2, 0.04,
				"hurt", "snailShell.png", 0, 0,
				"dead", "snailShell_upsidedown.png", 0, 0,
			]
		}
	};
	const players = {
		"p1": {
			"bodyWidthModifier": 0.5,
			"animationsData": [
				"stand", "p1_stand.png", 0, 0,
				"front", [ "p1_front.png", 10, "p1_blink.png" ], 1, 0.1,
				"jump", "p1_jump.png", 0, 0,
				"walk", "p1_walk/p1_walk", 11, 0.3,
				"hurt", "p1_hurt.png", 0, 0,
				"throw", "p1_jump.png", 0, 0,
				"duck", "p1_duck.png", 0, 0,
			]
		}, "p2": {
			"bodyWidthModifier": 0.5,
			"animationsData": [
				"stand", "p2_stand.png", 0, 0,
				"front", [ "p2_front.png", 10, "p2_blink.png" ], 1, 0.1,
				"jump", "p2_jump.png", 0, 0,
				"walk", "p2_walk/p2_walk", 11, 0.3,
				"hurt", "p2_hurt.png", 0, 0,
				"throw", "p2_jump.png", 0, 0,
				"duck", "p2_duck.png", 0, 0,
			]
		}, "p3": {
			"bodyWidthModifier": 0.5,
			"animationsData": [
				"stand", "p3_stand.png", 0, 0,
				"front", [ "p3_front.png", 10, "p3_blink.png" ], 1, 0.1,
				"jump", "p3_jump.png", 0, 0,
				"walk", "p3_walk/p3_walk", 11, 0.3,
				"hurt", "p3_hurt.png", 0, 0,
				"throw", "p3_jump.png", 0, 0,
				"duck", "p3_duck.png", 0, 0,
			]
		}
	};
	const items = {
		"star": {
			"animationsData": [
				"front", "star.png", 0, 0
			]
		}
	};

	g.loadLevel = async function ( name ) {
		if( !game.tiles ) {
			loadTiles();
		}
		if( !g.levelsImplemented.includes( name ) ) {
			throw new Error( "Level not implemented: " + name );
		}
		const response = await fetch( "assets/tiled/alien_" + name.toLowerCase() + ".json" );
		const json = await response.json();

		setTimeout( () => {
			g.sounds.intro.play();
		}, 300 );

		game.level = json;
		game.word = name;
	};

	g.startLevel = function ( stars ) {
		if( !game.level || !game.tiles ) {
			setTimeout( () => {
				g.startLevel( stars );
			}, 100 );
			return;
		}

		startingStars = stars;
		game.bodies = [];
		game.bodiesMap = {};
		game.items = [];
		game.player = {
			"id": g.userData.player,
			"health": 100,
			"maxHealth": 100,
			"stars": stars,
			"letters": "___",
			"item": null,
			"isActive": true
		};
		game.placedTiles = {};
		game.markers = {};
		game.enemies = [];
		game.fadeSprites = [];
		game.starExplosions = [];
		game.hurtItems = [];
		game.fadeItems = [];
		game.worldBounds = null;

		// Create the level container.
		if( game.container ) {
			g.app.stage.removeChild( game.container );
			game.container.destroy();
		}
		game.container = new PIXI.Container();
		game.container.scale.x = 1 / g.app.stage.scale.x;
		game.container.scale.y = 1 / g.app.stage.scale.y;
		game.container.alpha = 0;
		g.app.stage.addChild( game.container );

		// Create the HUD container.
		createHud();
		updateHud();
		hideControls();

		game.hud.alpha = 0;

		// Create the physics world.
		game.engine = Matter.Engine.create();

		// Map the layers properties
		game.level.layers.forEach( layer => {
			layer.propertyData = {};
			layer.properties.forEach( property => {
				layer.propertyData[ property.name ] = property.value;
			} );
		} );

		// Sort the level layers by order
		game.level.layers.sort( ( a, b ) => {
			return a.propertyData.order - b.propertyData.order;
		} );

		// Create the level objects.
		game.level.layers.forEach( layer => {
			const container = new PIXI.Container();
			game.container.addChild( container );
			if( layer.type === "tilelayer" ) {
				createTiles( layer, container );
			} else if( layer.type === "objectgroup" ) {
				createObjects( layer, container );
			}
		} );

		// Add the physics bodies to the world.
		Matter.Composite.add( game.engine.world, game.bodies );

		// Run the physics simulation.
		game.runner = Matter.Runner.create();
		Matter.Runner.run( game.runner, game.engine );

		game.engine.gravity.scale = GRAVITY_SCALE;

		// Set the initial camera position
		moveCamera();

		// Run the graphics step.
		game.elapsed = 0;
		g.app.ticker.add( step );

		// Fade in the level.
		g.app.ticker.add( fadeInStep );

		// Setup the collider event
		Matter.Events.on( game.engine, "collisionStart", collisionCheck );

		// Setup the input handlers.
		setupInputs();
	};

	g.resizeGame = function () {
		if( game.container ) {
			game.container.scale.x = 1 / g.app.stage.scale.x;
			game.container.scale.y = 1 / g.app.stage.scale.y;
			createHud();
			updateHud();
			centerCamera();
			moveCamera();
		}
	};

	async function loadTiles() {
		const response = await fetch( "assets/tiled/alien_tiles.json" );
		const json = await response.json();

		game.tiles = {};
		json.tiles.forEach( ( tile ) => {
			const name = tile.image.split( "/" ).pop();

			// Parse the tile properties
			tile.propertyData = {};
			if( tile.properties ) {
				tile.properties.forEach( property => {
					tile.propertyData[ property.name ] = property.value;
				} );
			}

			// Add the tile to the tiles map
			if( tile.propertyData[ "anim-1" ] ) {
				const frames = [ g.spritesheet.textures[ name ] ];
				let animId = "anim-1";
				let cnt = 1;
				while( tile.propertyData[ animId ] ) {
					frames.push( g.spritesheet.textures[ tile.propertyData[ animId ] ] );
					cnt += 1;
					animId = "anim-" + cnt;
				}
				game.tiles[ tile.id + 1 ] = {
					"animationFrames": frames,
					"animationSpeed": tile.propertyData[ "animationSpeed" ]
				};
			} else {
				game.tiles[ tile.id + 1 ] =  {
					"texture": g.spritesheet.textures[ name ]
				};
				// Load alternate sprites
				if( tile.propertyData[ "alt-1" ] ) {
					let altId = "alt-1";
					let cnt = 1;
					while( tile.propertyData[ altId ] ) {
						const altName = tile.propertyData[ altId ];
						game.tiles[ tile.id + 1 ].textureAlt = g.spritesheet.textures[ altName ];
						cnt += 1;
						altId = "alt-" + cnt;
					}
				}
			}
		} );
	}

	function createHud() {
		if( game.hud ) {
			g.app.stage.removeChild( game.hud );
			game.hud.destroy();
		}
		game.hud = new PIXI.Container();
		game.hud.scale.x = 1 / g.app.stage.scale.x;
		game.hud.scale.y = 1 / g.app.stage.scale.y;
		g.app.stage.addChild( game.hud );

		// Create the hud
		const hud = game.hud;
		const healthBar = new PIXI.Container();
		healthBar.x = 80;
		healthBar.y = 15;
		hud.addChild( healthBar );

		// Create a menu button
		const menuButton = new PIXI.Sprite(
			g.uiSprites.textures[ "Controls/transparentLight/transparentLight31.png" ]
		);
		menuButton.x = 10;
		menuButton.y = 10;
		menuButton.interactive = true;
		menuButton.on( "pointertap", () => {
			g.sounds.click.play();
			setTimeout( () => {
				hideControls( true );
				closeLevel( g.showLevelSelectionScreen );
			}, 0 );
		} );
		hud.addChild( menuButton );

		// Create the health bar background
		const healthBarBg = new PIXI.Graphics();
		healthBarBg.beginFill( "#780000" );
		healthBarBg.drawRect( 0, 0, 200, 40 );
		healthBarBg.endFill();
		healthBar.addChild( healthBarBg );

		// Create the health bar
		const healthBarFill = new PIXI.Graphics();
		healthBarFill.beginFill( "#007e00" );
		healthBarFill.drawRect( 0, 0, 200, 40 );
		healthBarFill.endFill();
		healthBar.addChild( healthBarFill );
		game.hud.healthBarFill = healthBarFill;

		// Create the health bar text
		const healthBarText = new PIXI.Text( "100%", {
			"fontFamily": "Arial",
			"fontSize": 32,
			"fill": "#ffffff"
		} );
		healthBarText.x = 100;
		healthBarText.y = 2;
		healthBarText.anchor.set( 0.5, 0 );
		healthBar.addChild( healthBarText );
		game.hud.healthBarText = healthBarText;

		// Create the letters text
		const lettersText = new PIXI.Text( "ART", {
			"fontFamily": "Arial",
			"fontSize": 32,
			"fill": "#ffffff",
			"stroke": "#000000",
			"strokeThickness": 3,
			"dropShadow": true,
			"dropShadowColor": "#000000",
		} );

		// Center the text on the screen
		lettersText.anchor.set( 0.5, 0 );
		lettersText.x = g.app.screen.width / 2;
		lettersText.y = 10;
		hud.addChild( lettersText );
		game.hud.lettersText = lettersText;

		// Create the stars text
		const starsText = new PIXI.Text( "0", {
			"fontFamily": "Arial",
			"fontSize": 32,
			"fill": "#ffffff",
			"stroke": "#000000",
			"strokeThickness": 3,
			"dropShadow": true,
			"dropShadowColor": "#000000",
		} );

		// Place the text in the top right corner
		starsText.anchor.set( 1, 0 );
		starsText.x = g.app.screen.width - 10;
		starsText.y = 10;
		hud.addChild( starsText );
		game.hud.starsText = starsText;

		// Create the stars icon
		const starIcon = new PIXI.Container();
		const starsIconBg = new PIXI.Graphics();
		starsIconBg.beginFill( "#00000055" );
		starsIconBg.drawCircle( 0, 0, 20 );
		starsIconBg.endFill();
		starIcon.addChild( starsIconBg );
		const starsIcon = new PIXI.Sprite( g.spritesheet.textures[ "star.png" ] );
		starsIcon.anchor.set( 0.5, 0.5 );
		starIcon.addChild( starsIcon );
		starIcon.x = g.app.screen.width - starsText.width - starIcon.width / 2 - 15;
		starIcon.y = 30;
		hud.addChild( starIcon );
		game.hud.starIcon = starIcon;

		// Create the center message text
		const centerMessageText = new PIXI.Text( "", {
			"fontFamily": "Times New Roman",
			"fontSize": 74,
			"fill": "#ffffff",
			"stroke": "#000000",
			"strokeThickness": 3,
			"dropShadow": true,
			"dropShadowColor": "#000000",
		} );
		centerMessageText.anchor.set( 0.5, 0.5 );

		// Create a center message overlay for big messages
		const centerMessage = new PIXI.Graphics();
		centerMessage.x = 0;
		centerMessage.y = 0;

		// Add the center message to the HUD
		centerMessage.addChild( centerMessageText );
		hud.addChild( centerMessage );
		game.hud.centerMessage = centerMessage;
		game.hud.centerMessageText = centerMessageText;

		// Show FPS
		if( SHOW_FPS ) {
			const fpsText = new PIXI.Text( "FPS: 0", {
				"fontFamily": "Arial",
				"fontSize": 12,
				"fill": "#ffffff"
			} );
			fpsText.x = 10;
			fpsText.y = 60;
			hud.addChild( fpsText );
			game.hud.fpsText = fpsText;
		}

		// Create the onscreen controls
		createOnscreenControls();
	}

	function createOnscreenControls() {

		// If the controls already exist, update their position and return
		if( game.onscreenControls ) {
			setOnscreenControlsPositions();
			return;
		}

		// Make the stage interactive
		g.app.stage.interactive = true;

		// Create the onscreen controls container
		game.onscreenControls = new PIXI.Container();
		game.onscreenControls.visible = false;
		g.app.stage.addChild( game.onscreenControls );

		// Track the touch points
		const touchPoints = [];

		// Define the button controls
		const buttons = [
			[ "Controls/transparentLight/transparentLight22.png", "ArrowLeft", "leftButton" ],
			[ "Controls/transparentLight/transparentLight23.png", "ArrowRight", "rightButton" ],
			[ "Controls/transparentLight/transparentLight25.png", "ArrowDown", "duckButton" ],
			[ "Controls/transparentLight/transparentLight24.png", "ArrowUp", "jumpButton" ],
			[ "Controls/transparentLight/transparentLight26.png", " ", "throwButton" ]
		];

		// Create the buttons
		buttons.forEach( buttonData => {
			const sprite = new PIXI.Sprite( g.uiSprites.textures[ buttonData[ 0 ] ] );
			sprite.interactive = true;
			sprite.on( "pointerdown", ( e ) => {
				touchPoints.push( {
					"pointer_id": e.pointerId,
					"x": e.global.x,
					"y": e.global.y,
					"keyname": buttonData[ 1 ],
					"buttonname": buttonData[ 2 ]
				} );
				game.keys[ buttonData[ 1 ] ] = true;
				sprite.tint = "#555555";
			} );
			sprite.on( "pointerup", ( e ) => {
				const index = touchPoints.findIndex( touchPoint => {
					return touchPoint.pointer_id === e.pointerId;
				} );
				touchPoints.splice( index, 1 );
				game.keys[ buttonData[ 1 ] ] = false;
				sprite.tint = "#ffffff";
			} );
			game.onscreenControls.addChild( sprite );
			game.onscreenControls[ buttonData[ 2 ] ] = sprite;
		} );

		// Clear the keys when the user stops touching the screen
		g.app.stage.on( "pointerup", ( e ) => {

			// Remove the touch point
			const index = touchPoints.findIndex( touchPoint => {
				return touchPoint.pointer_id === e.pointerId;
			} );

			if( index === -1 ) {
				return;
			}
			const touch = touchPoints[ index ];
			touchPoints.splice( index, 1 );

			// Update the keypress data
			game.keys[ touch.keyname ] = false;
			game.onscreenControls[ touch.buttonname ].tint = "#ffffff";
		} );

		// Set the positions of the onscreen controls
		setOnscreenControlsPositions();
	}

	function setOnscreenControlsPositions() {
		let buttonSize = 100;
		let buttonGap = 10;
		let scale = 1;

		if( g.app.screen.width < 800 ) {
			buttonSize = 50;
			buttonGap = 5;
			scale = 0.5;
		}

		game.onscreenControls.scale.x = 1 / g.app.stage.scale.x;
		game.onscreenControls.scale.y = 1 / g.app.stage.scale.y;
		game.onscreenControls.x = 0;
		game.onscreenControls.y = 0;

		// Left Button
		game.onscreenControls.leftButton.width = buttonSize;
		game.onscreenControls.leftButton.height = buttonSize;
		game.onscreenControls.leftButton.x = buttonGap;
		game.onscreenControls.leftButton.y = g.app.screen.height - buttonSize - buttonGap;

		// Right Button
		game.onscreenControls.rightButton.width = buttonSize;
		game.onscreenControls.rightButton.height = buttonSize;
		game.onscreenControls.rightButton.x = buttonSize + buttonGap * 2;
		game.onscreenControls.rightButton.y = g.app.screen.height - buttonSize - buttonGap;

		// Duck Button
		game.onscreenControls.duckButton.width = buttonSize;
		game.onscreenControls.duckButton.height = buttonSize;
		game.onscreenControls.duckButton.x = ( buttonSize + buttonGap ) * 2 + buttonGap;
		game.onscreenControls.duckButton.y = g.app.screen.height - buttonSize - buttonGap;

		// Jump Button
		game.onscreenControls.jumpButton.width = buttonSize;
		game.onscreenControls.jumpButton.height = buttonSize;
		game.onscreenControls.jumpButton.x = g.app.screen.width - ( buttonSize + buttonGap ) * 2 - buttonGap;
		game.onscreenControls.jumpButton.y = g.app.screen.height - buttonSize - buttonGap;

		// Throw Button
		game.onscreenControls.throwButton.width = buttonSize;
		game.onscreenControls.throwButton.height = buttonSize;
		game.onscreenControls.throwButton.x = g.app.screen.width - buttonSize - buttonGap;
		game.onscreenControls.throwButton.y = g.app.screen.height - buttonSize - buttonGap;
	}

	function showControls() {
		if( !game.onscreenControls ) {
			return;
		}
		game.onscreenControls.visible = true;

		// Remove the event handler
		g.app.stage.off( "pointerdown", showControls );
	}

	function hideControls( noEvent ) {
		if( !game.onscreenControls ) {
			return;
		}
		game.onscreenControls.visible = false;

		// Add the event handler
		if( !noEvent ) {

			// If the user touches the screen then show the onscreen controls
			g.app.stage.interactive = true;
			g.app.stage.on( "pointerdown", showControls );
		}
	}

	function setCenterMessage( message ) {
		game.hud.centerMessageText.text = message;
		const padding = 50;
		const left = ( g.app.screen.width - game.hud.centerMessageText.width ) / 2 - padding;
		const top = ( g.app.screen.height - game.hud.centerMessageText.height ) / 2 - padding;
		const right = left + game.hud.centerMessageText.width + padding * 2;
		const bottom = top + game.hud.centerMessageText.height + padding * 2;
		game.hud.centerMessageText.x = left + padding + game.hud.centerMessageText.width / 2;
		game.hud.centerMessageText.y = top + padding + game.hud.centerMessageText.height / 2;
		game.hud.centerMessage.clear();
		game.hud.centerMessage.beginFill( "#00000055" );
		game.hud.centerMessage.drawRoundedRect ( left, top, right - left, bottom - top, 25 );
		game.hud.centerMessage.endFill();
		game.hud.centerMessage.visible = true;
	}

	function updateHud() {
		const hud = game.hud;
		hud.healthBarText.text = Math.round( game.player.health ) + "%";
		hud.healthBarFill.x = 0;
		hud.healthBarFill.width = 200 * game.player.health / game.player.maxHealth;
		hud.starsText.text = game.player.stars;
		hud.lettersText.text = game.player.letters;
	}

	function createTiles( layer, container ) {
		for( let i = 0; i < layer.data.length; i++ ) {
			const tileId = layer.data[ i ];
			if( tileId && tileId !== 0 ) {

				// Create the sprite or animation
				let tile = null;
				if( game.tiles[ tileId ].animationFrames ) {
					tile = new PIXI.AnimatedSprite( game.tiles[ tileId ].animationFrames );
					tile.animationSpeed = game.tiles[ tileId ].animationSpeed;
					setTimeout( () => {
						tile.play();
					}, Math.random() * 1000 );
					container.addChild( tile );
				} else {
					tile = new PIXI.Sprite( game.tiles[ tileId ].texture );
				}

				// Set the sprite position
				const pos = game.container.toLocal( new PIXI.Point( 
					( i % layer.width ) * game.level.tilewidth,
					Math.floor( i / layer.width ) * game.level.tileheight
				) );
				tile.x = pos.x;
				tile.y = pos.y;

				// Add tinting
				if( layer.propertyData.tint ) {

					// Convert the hex color to HTML standard format remove the first two chars
					// which is the alpha value, as per TILED format.
					tile.tint = "#" + layer.propertyData.tint.substring( 3 );
				}
				container.addChild( tile );

				// Add alternate sprite
				if( game.tiles[ tileId ].textureAlt ) {
					tile.textureAlt = game.tiles[ tileId ].textureAlt;
				}

				// Add the tile to the placed tiles map
				const tileX = Math.round( tile.x ) + "";
				const tileY = Math.round( tile.y ) + "";
				game.placedTiles[ layer.name + "-" + tileX + "x" + tileY ] = tile;
				
			}
		}
	}

	function createObjects( layer, container ) {
		layer.objects.forEach( obj => {
			const copy = structuredClone( obj );
			if( obj.type === "ground" ) {
				createGround( copy );
			} else if( obj.type === "world-bounds" ) {
				createWorldBounds( copy );
			} else {
				createItem( copy, container );
			}
		} );
	}

	function createGround( obj ) {
		const body = Matter.Bodies.rectangle(
			obj.x + obj.width / 2,
			obj.y + obj.height / 2,
			obj.width,
			obj.height,
			{
				"isStatic": true,
				"customData": {
					"type": "ground"
				}
			}
		);
		body.friction = 0;
		game.bodies.push( body );
	}

	function createWorldBounds( obj ) {
		game.worldBounds = {
			"bounds": {
				"min": { "x": obj.x, "y": obj.y },
				"max": { "x": obj.x + obj.width, "y": obj.y + obj.height }
			}
		};
	}

	function createItem( obj, container ) {
		const item = {
			"animations": {},
			"animation": null,
			"data": {}
		};

		item.type = obj.type;

		let bodyType = "";
		let bodyWidth = 0;
		let bodyHeight = 0;
		let bodyInertia = Infinity;
		let isStatic = false;
		let animationsData = null;
		let fontProperties = {
			"fontFamily": "Arial",
			"align": "center"
		};
		let textOffsetY = 0;
		item.bodyWidthModifier = 1;
		item.bodyHeightModifier = 1;
		let hasSensors = false;

		// parse properties
		if( obj.properties ) {
			for( let i = 0; i < obj.properties.length; i++ ) {
				item.data[ obj.properties[ i ].name ] = obj.properties[ i ].value;
			}
		}

		if( item.type === "pickup" ) {
			bodyType = "pickup";
			isStatic = true;
			item.baseX = obj.x;
			item.baseY = obj.y;
			if( item.data.isLetter ) {
				item.text = obj.name;
				fontProperties.fontSize = 36;
				fontProperties.fill = "#ffffff";
				fontProperties.stroke = "#000000";
				fontProperties.strokeThickness = 3;
				fontProperties.dropShadow = true;
				fontProperties.dropShadowColor = "#000000";
				fontProperties.dropShadowBlur = 4;
			} else if( obj.name === "Star" ) {
				item.isStar = true;
				animationsData = items.star.animationsData;
				item.bodyWidthModifier = 0.35;
				item.bodyHeightModifier = 0.35;
			}
		} else if( item.type === "sign" ) {
			item.text = obj.name;
			bodyType = "none";
			if( item.text.length > 5 ) {
				fontProperties.fontSize = 12;
			} else {
				fontProperties.fontSize = 18;
			}
			fontProperties.fill = "#000000";
			textOffsetY = 8;
		} else if( item.type === "player" ) {
			game.player.item = item;
			animationsData = players[ game.player.id ].animationsData;
			bodyType = "actor";
			item.bodyWidthModifier = players[ game.player.id ].bodyWidthModifier;
		} else if ( item.type === "enemy" ) {
			const enemy = enemies[ obj.name ];
			item.speed = enemy.speed;
			item.damage = enemy.damage;
			animationsData = enemy.animationsData;
			bodyType = "actor";
			item.bodyWidthModifier = enemy.bodyWidthModifier;
			game.enemies.push( item );
			hasSensors = true;
			item.health = enemy.health;
		} else if( item.type === "trigger" ) {
			item.name = obj.name;
			bodyType = "trigger";
			isStatic = true;
			obj.x += obj.width / 2;
			obj.y += obj.height / 2;
			bodyWidth = obj.width;
			bodyHeight = obj.height;
		} else if( item.type === "marker" ) {
			bodyType = "none";
			game.markers[ obj.name ] = obj;
		} else if( item.type === "projectile" ) {
			bodyType = "projectile";
			isStatic = false;
			obj.x += obj.width / 2;
			obj.y += obj.height / 2;
			animationsData = items.star.animationsData;
			item.bodyWidthModifier = 0.35;
			item.bodyHeightModifier = 0.35;
			bodyInertia = 0;
		} else {
			bodyType = "none";
		}

		// Set item for actor
		if( bodyType === "actor" ) {
			item.isGrounded = false;
			item.idleTime = 0;
			item.throwCooldown = 0;
			item.hurtStartTime = 0;
		}

		// Create the item container.
		item.container = new PIXI.Container();
		item.container.x = obj.x;
		item.container.y = obj.y;
		container.addChild( item.container );

		// Create the item text
		if( item.text ) {
			item.pixiText = new PIXI.Text( item.text, fontProperties );
			item.pixiText.anchor.set( 0.5, 0.5 );
			item.container.addChild( item.pixiText );

			bodyWidth = ( item.pixiText.width - 8 );
			bodyHeight = ( item.pixiText.height - 18 );

			if( obj.width ) {
				obj.x += obj.width / 2;
			}
			if( obj.height ) {
				obj.y += obj.height / 2 - textOffsetY;
			}
			item.container.x = obj.x;
			item.container.y = obj.y;
		}

		// Create the animations
		if( animationsData ) {
			for( let i = 0; i < animationsData.length; i += 4 ) {
				const name = animationsData[ i ];
				const textureBaseName = animationsData[ i + 1 ];
				const count = animationsData[ i + 2 ];
				const speed = animationsData[ i + 3 ];
				const frames = [];
				if( count === 0 ) {
					frames.push( g.spritesheet.textures[ textureBaseName ] );
				} else {
					if( textureBaseName instanceof Array ) {
						for( let j = 0; j < textureBaseName[ 1 ]; j++ ) {
							frames.push( g.spritesheet.textures[ textureBaseName[ 0 ] ] );
						}
						frames.push( g.spritesheet.textures[ textureBaseName[ 2 ] ] );
					} else {
						for( let j = 1; j <= count; j++ ) {
							const id = j < 10 ? "0" + j : j;
							if( g.spritesheet.textures[ textureBaseName + id + ".png" ] ) {
								frames.push(
									g.spritesheet.textures[ textureBaseName + id + ".png" ]
								);
							} else {
								frames.push(
									g.spritesheet.textures[ textureBaseName + j + ".png" ]
								);
							}
						}
					}
				}
				const animation = new PIXI.AnimatedSprite( frames );
				animation.anchor.set( 0.5, 1 );
				animation.y = animation.height / 2;
				animation.animationSpeed = speed;
				animation.visible = false;
				item.animations[ name ] = animation;
				item.container.addChild( animation );
			}

			// Set the active animation
			item.animation = item.animations[ animationsData[ 0 ] ];
			item.animation.visible = true;
			item.animation.play();

			// Update the size and position of the item to match the animation.
			bodyWidth = item.animation.width * item.bodyWidthModifier;
			bodyHeight = item.animation.height * item.bodyHeightModifier;
			obj.y -= item.animation.height / 2;
			item.container.y = obj.y;
		}

		if( bodyType !== "none" ) {

			// Create the item physics body
			item.body = Matter.Bodies.rectangle(
				obj.x,
				obj.y,
				bodyWidth,
				bodyHeight,
				{
					"inertia": bodyInertia,
					"isStatic": isStatic,
					"isSensor": isStatic,
					"customData": { "type": bodyType }
				}
			);
			game.bodies.push( item.body );

			// Add a debug graphics object to show the physical body
			if( DEBUG ) {
				item.debug = new PIXI.Graphics();
				game.container.addChild( item.debug );
			}

			// Add item for easy access
			game.items.push( item );
			game.bodiesMap[ item.body.id ] = item;

			// Add cliff sensors
			if( hasSensors ) {
				const sensorWidth = 5;
				const sensorHeight = 5;
				const sensorOffsetX = bodyWidth / 2 + sensorWidth;
				const sensorOffsetY = bodyHeight / 2 + sensorHeight;
				item.sensors = [
					{
						"width": sensorWidth,
						"height": sensorHeight,
						"sensorOffsetX": -sensorOffsetX,
						"sensorOffsetY": sensorOffsetY,
						"body":
							Matter.Bodies.rectangle(
								obj.x - sensorOffsetX,
								obj.y + sensorOffsetY,
								sensorWidth,
								sensorHeight,
								{
									"isStatic": true,
									"isSensor": true,
									"customData": { "type": "cliffSensor" }
								}
							)
					}, {
						"width": sensorWidth,
						"height": sensorHeight,
						"sensorOffsetX": sensorOffsetX,
						"sensorOffsetY": sensorOffsetY,
						"body":
							Matter.Bodies.rectangle(
								obj.x + sensorOffsetX,
								obj.y + sensorOffsetY,
								sensorWidth,
								sensorHeight,
								{
									"isStatic": true,
									"isSensor": true,
									"customData": { "type": "cliffSensor" }
								}
							)
					}, {
						// Wall sensors
						"width": sensorWidth,
						"height": sensorHeight,
						"sensorOffsetX": sensorOffsetX,
						"sensorOffsetY": 0,
						"body":
							Matter.Bodies.rectangle(
								obj.x + sensorOffsetX,
								obj.y,
								sensorWidth,
								sensorHeight,
								{
									"isStatic": true,
									"isSensor": true,
									"customData": { "type": "wallSensor" }
								}
							)
					}, {
						"width": sensorWidth,
						"height": sensorHeight,
						"sensorOffsetX": -sensorOffsetX,
						"sensorOffsetY": 0,
						"body":
							Matter.Bodies.rectangle(
								obj.x - sensorOffsetX,
								obj.y,
								sensorWidth,
								sensorHeight,
								{
									"isStatic": true,
									"isSensor": true,
									"customData": { "type": "wallSensor" }
								}
							)
					}

				];
				game.bodies.push( item.sensors[ 0 ].body );
				game.bodies.push( item.sensors[ 1 ].body );
				game.bodies.push( item.sensors[ 2 ].body );
				game.bodies.push( item.sensors[ 3 ].body );

				// Add debug graphics
				if( DEBUG ) {
					for( let i = 0; i < item.sensors.length; i++ ) {
						const sensor = item.sensors[ i ];
						sensor.debug = new PIXI.Graphics();
						game.container.addChild( sensor.debug );
					}
				}
			}
		}

		return item;
	}

	function step( delta ) {

		// Update the FPS text
		if( SHOW_FPS ) {
			if( !game.fps ) {
				game.fps = {
					"min": Infinity,
					"max": 0,
					"avg": 0,
				};
			}
			if( g.app.ticker.FPS < game.fps.min ) {
				game.fps.min = g.app.ticker.FPS;
			}
			if( g.app.ticker.FPS > game.fps.max ) {
				game.fps.max = g.app.ticker.FPS;
			}
			game.fps.avg = ( game.fps.avg + g.app.ticker.FPS ) / 2;
			game.hud.fpsText.text = "FPS: " + Math.round( g.app.ticker.FPS ) + "\n" +
				"Min: " + Math.round( game.fps.min ) + "\n" +
				"Max: " + Math.round( game.fps.max ) + "\n" +
				"Avg: " + Math.round( game.fps.avg );
		}

		game.elapsed += delta;
		moveCamera();
		for( let i = 0; i < game.items.length; i++ ) {

			// Bob the pickup item up and down.
			if( game.items[ i ].type === "pickup" ) {
				const item = game.items[ i ];
				const body = item.body;
				const distance = body.position.y - item.baseY;
				const bobOffset = ( game.elapsed / 75 ) + ( i / ( Math.PI / 60 ) );
				const movement = Math.sin( bobOffset ) * 3 - distance / 5;
				Matter.Body.translate( body, { "x": 0, "y": movement } );
			}

			// Update the item's container position to match the physics body.
			updatePosition( game.items[ i ] );
		}

		// Apply player controls
		applyControls( game.player.item, delta );

		// Move the enemies
		moveEnemies( delta );

		// Run star explosions
		const starsToRemove = [];
		game.starExplosions.forEach( starExplosion => {
			starExplosion.scale.x += 0.06;
			starExplosion.scale.y += 0.06;
			starExplosion.rotation += 0.25;
			if( starExplosion.scale.x > 0.65 ) {
				starExplosion.alpha -= 0.15;
			}
			if( starExplosion.scale.x > 1 ) {
				game.container.removeChild( starExplosion );
				//game.starExplosions.splice( game.starExplosions.indexOf( starExplosion ), 1 );
				starsToRemove.push( starExplosion );
			}
		} );
		starsToRemove.forEach( starToRemove => {
			game.starExplosions.splice( game.starExplosions.indexOf( starToRemove ), 1 );
		} );

		// Run the dead bodies fade out
		const fadeSpritesToRemove = [];
		game.fadeSprites.forEach( fadeSprite => {
			if( fadeSprite.startTime + DEAD_BODY_FADE_START < game.elapsed ) {
				fadeSprite.sprite.alpha -= 0.01;
				if( fadeSprite.sprite.alpha <= 0 ) {
					game.container.removeChild( fadeSprite.sprite );
					fadeSpritesToRemove.push( fadeSprite );
				}
			}
		} );
		fadeSpritesToRemove.forEach( fadeSpriteToRemove => {
			game.fadeSprites.splice( game.fadeSprites.indexOf( fadeSpriteToRemove ), 1 );
		} );

		// Run the items fade out
		const fadeItemsToRemove = [];
		game.fadeItems.forEach( fadeItem => {
			fadeItem.animation.alpha -= 0.025;
			if( fadeItem.animation.alpha <= 0 ) {
				fadeItemsToRemove.push( fadeItem );
			}
		} );
		fadeItemsToRemove.forEach( fadeItemToRemove => {
			game.fadeItems.splice( game.fadeItems.indexOf( fadeItemToRemove ), 1 );
			if( fadeItemToRemove.type !== "player" ) {
				destroyItem( fadeItemToRemove );
			}
		} );

		// Update hurt animations
		const hurtItemsToRemove = [];
		game.hurtItems.forEach( hurtItem => {
			setAnimation( "hurt", hurtItem );
			hurtItem.animation.tint = "#ff0000";
			if( hurtItem.hurtStartTime + HURT_ANIMATION_DURATION < game.elapsed ) {
				hurtItem.animation.tint = "#ffffff";
				hurtItemsToRemove.push( hurtItem );
				setTimeout( () => {
					hurtItem.isHit = false;
					if( hurtItem.isGrounded ) {
						setAnimation( "front", hurtItem );
					} else {
						setAnimation( "jump", hurtItem );
					}
				}, 450 );
			}
		} );
		hurtItemsToRemove.forEach( hurtItemToRemove => {
			game.hurtItems.splice( game.hurtItems.indexOf( hurtItemToRemove ), 1 );
		} );
	}

	function fadeInStep( delta ) {
		game.container.alpha = Math.min( 1, game.container.alpha + FADE_IN_SPEED * delta );
		game.hud.alpha = Math.min( 1, game.hud.alpha + FADE_IN_SPEED * delta );

		if( game.container.alpha === 1 && game.hud.alpha === 1 ) {
			g.app.ticker.remove( fadeInStep );
		}
	}

	function updatePosition( item ) {
		const body = item.body;

		item.container.x = body.position.x;
		item.container.y = body.position.y;

		// Check if the item is outside the world bounds
		if( game.worldBounds && !item.outOfBounds ) {
			if( body.position.x < game.worldBounds.bounds.min.x ||
				body.position.x > game.worldBounds.bounds.max.x ||
				body.position.y > game.worldBounds.bounds.max.y
			) {
				item.outOfBounds = true;
				setTimeout( () => {
					if( item.type === "projectile" ) {
						game.fadeItems.push( item );
					} else if( item.type === "enemy" ) {
						enemyDeath( item );
					} else if( item.type === "player" ) {
						playerDeath( item );
					}
				}, 0 );
			}
		}

		// Update the rotation.
		item.container.rotation = body.angle;

		if( item.sensors ) {
			const sensors = item.sensors;
			for( let i = 0; i < sensors.length; i++ ) {
				const sensor = sensors[ i ];
				Matter.Body.setPosition( sensor.body, {
					"x": body.position.x + sensor.sensorOffsetX,
					"y": body.position.y + sensor.sensorOffsetY
				} );
			}

			// Check if the cliff sensors are colliding with anything
			for( let i = 0; i < sensors.length; i++ ) {
				const sensor = sensors[ i ];
				sensor.isGrounded = false;
				const collisions = Matter.Query.collides( sensor.body, game.bodies );
				if( collisions.length > 0 ) {
					for( let j = 0; j < collisions.length; j++ ) {
						const collision = collisions[ j ];
						if( collision.bodyA === collision.bodyB ) {
							continue;
						}
						const otherBody = collision.bodyA === sensor.body ?
								collision.bodyB : collision.bodyA;
						if(
							otherBody.customData.type === "ground" ||
							otherBody.customData.type === "actor" &&
							game.bodiesMap[ otherBody.id ].type !== "player"
						) {
							sensor.isGrounded = true;
						}
					}
				}
			}
		}

		// Draw a wire frame around the item using the body vertices.
		if( item.debug ) {
			item.debug.clear();
			if( item.isGrounded ) {
				item.debug.lineStyle( 1, "#0000ff" );
			} else {
				item.debug.lineStyle( 1, "#00ff00" );
			}
			item.debug.beginFill( "#000000", 0 );
			item.debug.moveTo( body.vertices[ 0 ].x, body.vertices[ 0 ].y );
			for( let i = 1; i < body.vertices.length; i++ ) {
				item.debug.lineTo( body.vertices[ i ].x, body.vertices[ i ].y );
			}
			item.debug.lineTo( body.vertices[ 0 ].x, body.vertices[ 0 ].y );
			item.debug.endFill();

			// Update position of the cliff sensors debug graphics
			if( item.sensors ) {
				item.sensors.forEach( sensor => {
					sensor.debug.clear();
					sensor.debug.x = sensor.body.position.x;
					sensor.debug.y = sensor.body.position.y;
					if( sensor.isGrounded ) {
						sensor.debug.lineStyle( 1, "#0000ff" );
					} else {
						sensor.debug.lineStyle( 1, "#00ff00" );
					}
					sensor.debug.beginFill( "#000000", 0 );
					sensor.debug.drawRect(
						-sensor.width / 2, -sensor.height / 2, sensor.width, sensor.height
					);
					sensor.debug.endFill();
				} );
			}

		}
	}

	function applyControls( itemPlayer, delta ) {

		// Check if player is active
		if( !game.player.isActive ) {
			setAnimation( "stand", itemPlayer );
			return;
		}

		// Check if player is dead or hurt
		if( itemPlayer.isHit || itemPlayer.isDead ) {
			setAnimation( "hurt", itemPlayer );
			return;
		}

		// Apply player movement for platformer controls.
		const keys = game.keys;
		const speed = 5 * delta;

		// Apply movement.
		let isWalking = false;
		let isThrowing = false;
		let isDucking = false;
		if( keys.ArrowLeft ) {

			isWalking = true;

			// Set the orientation.
			itemPlayer.animation.scale.x = -1;

			// Apply the movement.
			Matter.Body.translate( itemPlayer.body, { "x": -speed, "y": 0 } );

		} else if( keys.ArrowRight ) {

			isWalking = true;

			// Set the orientation.
			itemPlayer.animation.scale.x = 1;

			// Apply the movement.
			Matter.Body.translate( itemPlayer.body, { "x": speed, "y": 0 } );

			//g.sounds.walk2.play();
		} else if( keys.ArrowDown ) {
			isDucking = true;
		}


		// Check if falling, allow for a little bit of leeway.
		if( itemPlayer.isGrounded && itemPlayer.body.velocity.y > MAX_VELOCITY_Y_FOR_GROUNDED ) {
			itemPlayer.isGrounded = false;
		}

		// Apply Jumping
		if( keys.ArrowUp ) {
			if( itemPlayer.isGrounded ) {

				// Don't jump if player is going up
				if( itemPlayer.body.velocity.y > -1 ) {
					g.sounds.jump.play();

					// Apply the jump force
					let jumpForce = -JUMP_FORCE;
					Matter.Body.applyForce(
						itemPlayer.body, itemPlayer.body.position, { "x": 0, "y": jumpForce }
					);
				}
				itemPlayer.isGrounded = false;
			}
		}

		// Apply throwing
		if( itemPlayer.throwCooldown > 0 ) {
			itemPlayer.throwCooldown -= delta;
		}
		if( keys[ " " ] ) {
			if( itemPlayer.throwCooldown <= 0 ) {
				itemPlayer.throwCooldown = THROW_COOLDOWN;
				throwStar( itemPlayer, isDucking );
			}
		}
		if( itemPlayer.throwCooldown > THROW_ANIMATION_DURATION ) {
			isThrowing = true;
		}

		if( itemPlayer.isGrounded ) {

			// Stop player from sliding
			Matter.Body.setVelocity( itemPlayer.body, { "x": 0, "y": itemPlayer.body.velocity.y } );
		}

		// Set the animation
		if( isThrowing ) {
			setAnimation( "throw", itemPlayer );
		} else if( isWalking && itemPlayer.isGrounded ) {
			//walkSound();
			setAnimation( "walk", itemPlayer );
		} else if( !itemPlayer.isGrounded ) {
			setAnimation( "jump", itemPlayer );
		} else if( isDucking ) {
			setAnimation( "duck", itemPlayer );
		} else {

			// Start idle animation
			itemPlayer.idleTime += delta;
			if( itemPlayer.idleTime > IDLE_ANIMATION_START ) {
				setAnimation( "front", itemPlayer );
			} else {
				setAnimation( "stand", itemPlayer );
			}
		}
	}

	function walkSound() {
		if( !game.player.walkSoundTime || game.player.walkSoundTime + 15 < game.elapsed ) {
			game.player.walkSoundTime = game.elapsed;

			// Alternate between two sounds
			if( !game.player.walkSound ) {
				game.player.walkSound = 1;
				g.sounds.walk1.play();
			} else {
				game.player.walkSound = 0;
				g.sounds.walk2.play();
			}
		}
	}

	function throwStar( itemPlayer, isDucking ) {
		if( game.player.stars <= 0 ) {
			return;
		}
		g.sounds.throw.play();
		game.player.stars -= 1;
		updateHud();
		let yVelocity;
		if( isDucking ) {
			yVelocity = -1.5 + itemPlayer.body.velocity.y / 2;
		} else {
			yVelocity = -7 + itemPlayer.body.velocity.y / 2;
		}
		const star = createItem( {
			"type": "projectile",
			"name": "star",
			"x": itemPlayer.body.position.x +
				( itemPlayer.container.width / 2 + 10 ) * itemPlayer.animation.scale.x,
			"y": itemPlayer.body.position.y + itemPlayer.container.height / 2 - 10,
			"width": 10,
			"height": 10
		}, game.container );
		Matter.World.add( game.engine.world, star.body );
		Matter.Body.setVelocity( star.body, {
			"x": itemPlayer.animation.scale.x * 7,
			"y": yVelocity
		} );
		Matter.Body.setAngularVelocity( star.body, 0.25 );
	}

	function setAnimation( name, actor ) {

		// If animation is already active then do nothing
		if( actor.animation === actor.animations[ name ] ) {
			return;
		}

		// Since we are changing animations, reset the idle time.
		if( name !== "front" ) {
			actor.idleTime = 0;
		}

		// Stop the current animation
		actor.animation.visible = false;
		actor.animation.gotoAndStop( 0 );

		// Calculate the vertical displacement of the animation
		const displacementY = actor.animation.height - actor.animations[ name ].height;

		// Math the orientation of the new animation to the current orientation
		actor.animations[ name ].scale.x = actor.animation.scale.x;

		// Start the new animation
		actor.animation = actor.animations[ name ];
		actor.animation.visible = true;
		actor.animation.play();

		// Only update the physics body if the displacement is significant
		if( Math.abs( displacementY ) > 5 ) {

			// Update the size and position of the item to match the animation.
			const bodyWidth = actor.animation.width * actor.bodyWidthModifier;
			const bodyHeight = actor.animation.height * actor.bodyHeightModifier;

			// Update the physics body
			Matter.Body.set( actor.body, {
				"vertices": [
					{ "x": -bodyWidth / 2, "y": -bodyHeight / 2 },
					{ "x": bodyWidth / 2, "y": -bodyHeight / 2 },
					{ "x": bodyWidth / 2, "y": bodyHeight / 2 },
					{ "x": -bodyWidth / 2, "y": bodyHeight / 2 }
				],
				"inertia": Infinity
			} );

			// Translate the body to keep the feet on the ground
			Matter.Body.translate( actor.body, { "x": 0, "y": displacementY / 2 } );

			// Update the position of the image container
			actor.container.y = actor.body.position.y;
			actor.container.x = actor.body.position.x;
		}
	}

	function moveEnemies( delta ) {
		for( let i = 0; i < game.enemies.length; i++ ) {
			const enemy = game.enemies[ i ];
			const body = enemy.body;

			// Check if the enemy is on the ground
			if( enemy.isGrounded && body.velocity.y > MAX_VELOCITY_Y_FOR_GROUNDED ) {
				enemy.isGrounded = false;
			}

			// Check the enemy's sensors
			if( enemy.isGrounded && enemy.sensors ) {
				const sensors = enemy.sensors;

				// Check if the enemy is about to walk off a cliff
				if(
					( enemy.speed < 0 && !sensors[ 0 ].isGrounded ) ||
					( enemy.speed > 0 && !sensors[ 1 ].isGrounded )
				) {
					enemy.speed *= -1;
					enemy.animation.scale.x *= -1;
				}

				// Check if the enemy is about to hit a wall
				if(
					( enemy.speed < 0 && sensors[ 3 ].isGrounded ) ||
					( enemy.speed > 0 && sensors[ 2 ].isGrounded )
				) {
					enemy.speed *= -1;
					enemy.animation.scale.x *= -1;
				}
			}

			// Apply the movement
			const speed = enemy.speed * delta;
			Matter.Body.translate( body, { "x": speed, "y": 0 } );

			// Set the animation
			if( enemy.isGrounded ) {
				setAnimation( "walk", enemy );
			} else {
				setAnimation( "jump", enemy );
			}
		}
	}

	function moveCamera() {
		const player = game.player.item;

		// Make sure camera doesn't go beyond the world bounds
		const cameraMinX = game.worldBounds.bounds.min.x;
		const cameraMaxX = game.worldBounds.bounds.max.x;
		const cameraMinY = game.worldBounds.bounds.min.y;
		const cameraMaxY = game.worldBounds.bounds.max.y;
		const cameraX = Math.max( cameraMinX, Math.min( cameraMaxX, player.container.x ) );
		const cameraY = Math.max( cameraMinY, Math.min( cameraMaxY, player.container.y ) );

		// Convert the coordinates to screen space.
		const left = -cameraX / g.app.stage.scale.x;
		const top = -cameraY / g.app.stage.scale.y;
		const offsetX = g.app.screen.width / g.app.stage.scale.x * 0.5;
		const offsetY = g.app.screen.height / g.app.stage.scale.y * 0.5;

		// Set the x position
		const targetX = left + offsetX;
		const minX = targetX - ( g.app.screen.width * 0.075 );
		const maxX = targetX + ( g.app.screen.width * 0.075 );
		if( game.container.x < minX ) {
			game.container.x = minX;
		} else if( game.container.x > maxX ) {
			game.container.x = maxX;
		}

		// Set the y position
		const targetY = top + offsetY;
		const minY = targetY - ( g.app.screen.height * 0.18 );
		const maxY = targetY + ( g.app.screen.height * 0.18 );
		if( game.container.y < minY ) {
			game.container.y = minY;
		} else if( game.container.y > maxY ) {
			game.container.y = maxY;
		}
	}

	function centerCamera() {
		const player = game.player.item;

		// Convert the coordinates to screen space.
		game.container.x = -player.container.x / g.app.stage.scale.x + g.app.screen.width / g.app.stage.scale.x * 0.5;
		game.container.y = -player.container.y / g.app.stage.scale.y + g.app.screen.height / g.app.stage.scale.y * 0.5;
	}

	function setupInputs() {
		const keys = {};
		document.addEventListener( "keydown", keydown );
		window.addEventListener( "blur", blur );
		document.addEventListener( "keyup", keyup );
		game.keys = keys;
	}

	function clearInputs() {
		document.removeEventListener( "keydown", keydown );
		document.removeEventListener( "keyup", keyup );
		game.keys = {};
	}

	function keydown( e ) {
		game.keys[ e.key ] = true;
		hideControls();
	}

	function keyup( e ) {
		game.keys[ e.key ] = false;
	}

	function blur() {
		game.keys = {};
	}

	function collisionCheck( collisions ) {
		const pairs = collisions.source.pairs.list;
		for( let i = 0; i < pairs.length; i++ ) {
			const pair = pairs[ i ];
			const a = pair.bodyA.customData;
			const b = pair.bodyB.customData;
			const penetration = pair.collision.penetration;

			// Check for an actor hitting the ground
			if( a.type === "actor" && b.type === "ground" && penetration.y < 0 ) {
				game.bodiesMap[ pair.bodyA.id ].isGrounded = true;
			} else if ( a.type === "ground" && b.type === "actor" && penetration.y > 0) {
				game.bodiesMap[ pair.bodyB.id ].isGrounded = true;
			}

			// Check for a player hitting a pickup item.
			let actor;
			let pickup;
			if( a.type === "actor" && b.type === "pickup" ) {
				actor = game.bodiesMap[ pair.bodyA.id ];
				pickup = game.bodiesMap[ pair.bodyB.id ];
			} else if( a.type === "pickup" && b.type === "actor" ) {
				actor = game.bodiesMap[ pair.bodyB.id ];
				pickup = game.bodiesMap[ pair.bodyA.id ];
			}

			if( actor && pickup && actor.type === "player" ) {
				pickupItem( pickup );
			}

			// Check for a player hitting a trigger.
			if( a.type === "actor" && b.type === "trigger" ) {
				actor = game.bodiesMap[ pair.bodyA.id ];
				triggers( actor, game.bodiesMap[ pair.bodyB.id ] );
			} else if( a.type === "trigger" && b.type === "actor" ) {
				actor = game.bodiesMap[ pair.bodyB.id ];
				triggers( actor, game.bodiesMap[ pair.bodyA.id ] );
			}

			// Check for a projectile hitting something
			if( a.type === "projectile" && b.type !== "pickup") {
				projectileHit( game.bodiesMap[ pair.bodyA.id ] );
			} else if( b.type === "projectile" && a.type !== "pickup" ) {
				projectileHit( game.bodiesMap[ pair.bodyB.id ] );
			}

			// Check for another actor
			if( a.type === "actor" && b.type === "actor" ) {
				const actorA = game.bodiesMap[ pair.bodyA.id ];
				const actorB = game.bodiesMap[ pair.bodyB.id ];

				// Check for a player hitting an enemy
				if( actorA.type === "player" && actorB.type !== "player" ) {
					playerHit( actorA, actorB );
				} else if( actorB.type === "player" && actorA.type !== "player" ) {
					playerHit( actorB, actorA );
				}
			}
		}
	}

	function playerHit( itemPlayer, enemy ) {
		if( itemPlayer.isHit || itemPlayer.isDead ) {
			return;
		}
		if( itemPlayer.hurtStartTime + HURT_ANIMATION_DURATION < game.elapsed ) {
			g.sounds.playerHit.play();
			game.player.health -= enemy.damage;
			updateHud();
			itemPlayer.hurtStartTime = game.elapsed;
			game.hurtItems.push( itemPlayer );
			itemPlayer.isHit = true;

			// Wait until after the collision check to apply the knockback
			setTimeout( () => {

				// Add knockback effect
				const xDirection = itemPlayer.body.position.x < enemy.body.position.x ? -1 : 1;
				const xForce = xDirection * HIT_FORCE / 2;
				let yForce = -HIT_FORCE;
				if( itemPlayer.body.velocity.y < -1 ) {
					yForce = 0;
				}
				Matter.Body.applyForce(
					itemPlayer.body, itemPlayer.body.position, { "x": xForce, "y": yForce }
				);
				itemPlayer.isGrounded = false;

				// Check for player death
				if( game.player.health <= 0 ) {
					game.player.health = 0;
					updateHud();
					playerDeath( itemPlayer );
				}
			}, 0 );
		}
	}

	function playerDeath( itemPlayer ) {

		// Set the player to dead
		itemPlayer.isDead = true;

		// Show the game over message
		setCenterMessage( "Game Over" );

		// Give the player inertia so they fall over
		Matter.Body.setInertia( itemPlayer.body, 100 );
		Matter.Body.setAngularVelocity( itemPlayer.body, 0.15 );

		setTimeout( () => {
			g.sounds.lose.play();
		}, 150 );

		// Restart the level
		hideControls( true );
		setTimeout( () => {
			closeLevel( () => {
				g.startLevel( startingStars );
			} );
		}, 1500 );
	}

	function projectileHit( projectile ) {
		if( !projectile ) {
			return;
		}

		// Remove the projectile
		destroyItem( projectile );

		// Create a star explosion
		const starExplosion = new PIXI.Sprite( g.spritesheet.textures[ "star2.png" ] );
		starExplosion.anchor.set( 0.5, 0.5 );
		starExplosion.x = projectile.body.position.x;
		starExplosion.y = projectile.body.position.y;
		starExplosion.scale.set( 0.05, 0.05 );
		starExplosion.rotation = Math.random() * Math.PI * 2;
		starExplosion.tint = "#F1FCC2";
		game.container.addChild( starExplosion );
		game.starExplosions.push( starExplosion );

		// Add a damage effect for enemies in the explosion radius
		const damageRadius = 75;

		if( DEBUG ) {
			const damageAreaDebug = new PIXI.Graphics();
			damageAreaDebug.lineStyle( 1, "#ff0000" );
			damageAreaDebug.beginFill( "#000000", 0 );
			damageAreaDebug.drawCircle(
				projectile.body.position.x, projectile.body.position.y, damageRadius
			);
			damageAreaDebug.endFill();
			game.container.addChild( damageAreaDebug );
			setTimeout( () => {
				game.container.removeChild( damageAreaDebug );
			}, 1000 );
		}
		const damageArea = Matter.Query.region( game.bodies, {
			"min": {
				"x": projectile.body.position.x - damageRadius,
				"y": projectile.body.position.y - damageRadius
			},
			"max": {
				"x": projectile.body.position.x + damageRadius,
				"y": projectile.body.position.y + damageRadius
			}
		} );

		let enemyHit = false;
		for( let i = 0; i < damageArea.length; i++ ) {
			const body = damageArea[ i ];
			const item = game.bodiesMap[ body.id ];
			if( item && item.type === "enemy" ) {
				const distance = Math.sqrt(
					Math.pow( projectile.body.position.x - body.position.x, 2 ) +
					Math.pow( projectile.body.position.y - body.position.y, 2 )
				);
				const damage = Math.max( 0, 100 * ( damageRadius - distance ) / damageRadius );
				item.health -= damage;
				if( damage > 0 ) {
					enemyHit = true;
					item.hurtStartTime = game.elapsed;
					game.hurtItems.push( item );
				}
				if( item.health <= 0 ) {
					setTimeout( () => {
						enemyDeath( item );
					}, 100 );
				}
			}
		}

		if( enemyHit ) {
			g.sounds.explosion2.play();
		} else {
			g.sounds.explosion.play();
		}
	}

	function enemyDeath( enemy ) {

		// Create the enemy dead body
		const deadBody = new PIXI.Sprite( enemy.animations[ "dead" ].textures[ 0 ] );
		deadBody.anchor.set( 0.5, 0.5 );
		deadBody.x = enemy.body.position.x;
		deadBody.y = enemy.body.position.y + ( enemy.container.height - deadBody.height ) / 2;
		game.container.addChild( deadBody );
		game.fadeSprites.push( {
			"sprite": deadBody,
			"startTime": game.elapsed,
		} );

		// Remove the enemy
		destroyItem( enemy );
	}

	function destroyItem( item ) {

		if( item.isDestroyed ) {
			return;
		}

		item.isDestroyed = true;

		// Remove the item from the physics world.
		if( item.body ) {
			Matter.Composite.remove( game.engine.world, item.body );
			game.bodies.splice( game.bodies.indexOf( item.body ), 1 );
			delete game.bodiesMap[ item.body.id ];
		}

		// Remove the item from the game.
		game.items.splice( game.items.indexOf( item ), 1 );

		// Remove the item from other arrays
		if( item.type === "enemy" ) {
			game.enemies.splice( game.enemies.indexOf( item ), 1 );
		}

		// Remove the item from the display.
		item.container.parent.removeChild( item.container );
		item.container.destroy();
		if( DEBUG ) {
			game.container.removeChild( item.debug );
		}

		// Remove their sensors
		if( item.sensors ) {
			for( let i = 0; i < item.sensors.length; i++ ) {
				Matter.Composite.remove( game.engine.world, item.sensors[ i ].body );
				if( DEBUG ) {
					game.container.removeChild( item.sensors[ i ].debug );
				}
			}
		}
	}

	function pickupItem( pickup ) {

		// Remove the item from the physics world.
		Matter.Composite.remove( game.engine.world, pickup.body );

		// Remove the item from the game.
		game.items.splice( game.items.indexOf( pickup ), 1 );
		delete game.bodiesMap[ pickup.body.id ];

		// Remove the item from the display.
		pickup.container.parent.removeChild( pickup.container );
		pickup.container.destroy();

		if( DEBUG ) {
			game.container.removeChild( pickup.debug );
		}

		// Update the game stats
		if( pickup.data.isLetter ) {
			g.sounds.letter.play();
			game.player.health += 30;
			game.player.health = Math.min( game.player.health, 100 );

			const letter = pickup.text;
			const index = game.word.indexOf( letter );
			game.player.letters = game.player.letters.substring( 0, index ) + letter +
				game.player.letters.substring( index + 1 );
			
			updateHud();

			// Check if the word is complete
			if( game.player.letters === game.word ) {
				setTimeout( () => {
					openExit();
				}, 500 );
			}
		} else if( pickup.isStar ) {
			g.sounds.pickup.play();
			game.player.stars += 1;
			game.player.stars = Math.min( game.player.stars, 99 );
			game.player.health += 15;
			game.player.health = Math.min( game.player.health, 100 );
			updateHud();
		}
	}

	function openExit() {

		game.exitOpen = true;
		g.sounds.open.play();

		// Find the tiles in the same location as the exit and set them to the alternate sprite.
		const exitImage = game.markers[ "exit-image" ];

		// Update the first texture
		const tile1X = Math.round( exitImage.x ) + "";
		const tile1Y = Math.round( exitImage.y ) + "";
		const tile1 = game.placedTiles[ MIDDLE_LAYER + "-" + tile1X + "x" + tile1Y ];
		tile1.texture = tile1.textureAlt;
		tile1.texture.update();

		// Update the second texture
		const tile2X = Math.round( exitImage.x ) + "";
		const tile2Y = Math.round( exitImage.y + tile1.height ) + "";
		const tile2 = game.placedTiles[
			MIDDLE_LAYER + "-" + tile2X + "x" + tile2Y
		];
		tile2.texture = tile2.textureAlt;
		tile2.texture.update();
	}

	function triggers( actor, trigger ) {
		if(
			actor.type === "player" &&
			trigger.name === "exit" &&
			game.exitOpen
		) {
			setTimeout( () => {
				g.sounds.win.play();
			}, 500 );
			setCenterMessage( "Level Complete" );
			game.player.isActive = false;
			game.fadeItems.push( actor );
			g.completeLevel( game.word, game.player.stars );
			hideControls( true );
			setTimeout( () => {
				closeLevel( g.showLevelSelectionScreen );
			}, 2000 );
		}
	}

	function closeLevel( callback ) {
		if( typeof callback !== "function" ) {
			throw new Error( "callback must be a function" );
		}
		game.afterFadeOut = callback;
		clearInputs();
		g.app.ticker.add( fadeOutStep );
	}

	function fadeOutStep( delta ) {
		game.container.alpha -= FADE_OUT_SPEED * delta;
		game.hud.alpha -= FADE_OUT_SPEED * delta;
		if( game.container.alpha <= 0 ) {

			// Remove the fade out ticker
			g.app.ticker.remove( fadeOutStep );

			// Remove the game step ticker
			g.app.ticker.remove( step );

			// Remove the graphics items
			g.app.stage.removeChild( game.container );
			game.container.destroy();
			g.app.stage.removeChild( game.hud );
			game.hud.destroy();

			// Remove the physics items
			Matter.Runner.stop( game.runner );
			Matter.Engine.clear( game.engine );

			// Get the callback function
			const callback = game.afterFadeOut;

			// Reset the level
			game = {
				"tiles": game.tiles,
				"level": game.level,
				"word": game.word
			};

			// Run the callback
			callback();
		}
	}

} )();

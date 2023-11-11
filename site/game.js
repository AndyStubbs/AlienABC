"use strict";

( function () {

	const game = {};
	const MAX_VELOCITY_Y_FOR_GROUNDED = 2.5;
	const JUMP_FORCE = -0.125;
	const DEBUG = true;
	const MIDDLE_LAYER = "Middle 1";

	g.loadLevel = async function ( name ) {
		if( !game.tiles ) {
			loadTiles();
		}
		const response = await fetch( "assets/tiled/alien-" + name + ".json" );
		const json = await response.json();
		game.level = json;
		game.word = name;
	};

	g.startLevel = function ( ) {
		if( !game.level || !game.tiles ) {
			setTimeout( g.startLevel, 100 );
			return;
		}

		game.bodies = [];
		game.itemsMap = {};
		game.items = [];
		game.player = {
			"health": 100,
			"maxHealth": 100,
			"stars": 0,
			"letters": "___"
		};
		game.placedTiles = {};
		game.markers = {};

		// Create the level container.
		if( game.container ) {
			game.app.stage.removeChild( game.container );
			game.container.destroy();
		}
		game.container = new PIXI.Container();
		game.container.scale.x = 1 / g.app.stage.scale.x;
		game.container.scale.y = 1 / g.app.stage.scale.y;
		g.app.stage.addChild( game.container );

		// Create the HUD container.
		createHud();
		updateHud();

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

		// Set the initial camera position
		moveCamera();

		// Run the graphics step.
		game.elapsed = 0;
		g.app.ticker.add( step );

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
			moveCamera();
		}
	};

	async function loadTiles() {
		const response = await fetch( "assets/tiled/alien-tiles.json" );
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

		const hud = game.hud;
		const healthBar = new PIXI.Container();
		healthBar.x = 10;
		healthBar.y = 10;
		hud.addChild( healthBar );

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
	}

	function updateHud() {
		const hud = game.hud;
		hud.healthBarText.text = Math.round( game.player.health ) + "%";
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
			if( obj.type === "ground" ) {
				createGround( obj );
			} else {
				createItem( obj, container );
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
		let isStatic = false;
		let animationsData = null;
		let fontProperties = {
			"fontFamily": "Arial",
			"align": "center"
		};
		let textOffsetY = 0;
		let bodyWidthModifier = 1;

		// parse properties
		if( obj.properties ) {
			for( let i = 0; i < obj.properties.length; i++ ) {
				item.data[ obj.properties[ i ].name ] = obj.properties[ i ].value;
			}
		}

		if( item.data.isLetter ) {
			item.text = obj.name;
			bodyType = "pickup";
			isStatic = true;
			item.baseX = obj.x;
			item.baseY = obj.y;
			fontProperties.fontSize = 36;
			fontProperties.fill = "#ffffff";
			fontProperties.stroke = "#000000";
			fontProperties.strokeThickness = 3;
			fontProperties.dropShadow = true;
			fontProperties.dropShadowColor = "#000000";
			fontProperties.dropShadowBlur = 4;
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
		} else if( item.data.isPlayer ) {
			game.player.obj = item;
			animationsData = [
				"front", "p1_front.png", 0,
				"jump", "p1_jump.png", 0,
				"walk", "p1_walk/p1_walk", 11
			];
			bodyType = "actor";
			bodyWidthModifier = 0.5;
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
		} else {
			bodyType = "none";
		}

		// Get the position of the item in the game container.
		let pos = game.container.toLocal( new PIXI.Point( obj.x, obj.y ) );

		// Create the item container.
		item.container = new PIXI.Container();
		item.container.x = pos.x;
		item.container.y = pos.y;
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
			pos = game.container.toLocal( new PIXI.Point( obj.x, obj.y ) );
			item.container.x = pos.x;
			item.container.y = pos.y;
		}

		// Create the animations
		if( animationsData ) {
			for( let i = 0; i < animationsData.length; i += 3 ) {
				const name = animationsData[ i ];
				const textureBaseName = animationsData[ i + 1 ];
				const count = animationsData[ i + 2 ];
				const frames = [];
				if( count === 0 ) {
					frames.push( g.spritesheet.textures[ textureBaseName ] );
				} else {
					for( let j = 1; j <= count; j++ ) {
						const id = j < 10 ? "0" + j : j;
						frames.push( g.spritesheet.textures[ textureBaseName + id + ".png" ] );
					}
				}
				const animation = new PIXI.AnimatedSprite( frames );
				animation.anchor.set( 0.5, 0.5 );
				animation.animationSpeed = 0.3;
				animation.visible = false;
				item.animations[ name ] = animation;
				item.container.addChild( animation );
			}

			// Set the active animation
			item.animation = item.animations[ animationsData[ 0 ] ];
			item.animation.visible = true;
			item.animation.play();

			// Update the size and position of the item to match the animation.
			bodyWidth = item.animation.width * bodyWidthModifier;
			bodyHeight = item.animation.height;
			obj.y -= item.animation.height / 2;
			pos = game.container.toLocal( new PIXI.Point( obj.x, obj.y ) );
			item.container.y = pos.y;
		}

		if( bodyType !== "none" ) {

			// Create the item physics body
			item.body = Matter.Bodies.rectangle(
				obj.x,
				obj.y,
				bodyWidth,
				bodyHeight,
				{
					"inertia": Infinity,
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
			game.itemsMap[ item.body.id ] = item;
		}
	}

	function step( delta ) {
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
		applyControls( game.player.obj );
	}

	function updatePosition( item ) {
		const body = item.body;

		item.container.x = body.position.x;
		item.container.y = body.position.y;

		// Update the rotation.
		item.container.rotation = body.angle;

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
		}
	}

	function applyControls( player ) {

		// Apply player movement for platformer controls.
		const keys = game.keys;
		const speed = 5;

		// Apply movement.
		let isWalking = false;
		if( keys.ArrowLeft ) {

			isWalking = true;

			// Set the orientation.
			player.animation.scale.x = -1;

			// Apply the movement.
			Matter.Body.translate( player.body, { "x": -speed, "y": 0 } );

		} else if( keys.ArrowRight ) {

			isWalking = true;

			// Set the orientation.
			player.animation.scale.x = 1;

			// Apply the movement.
			Matter.Body.translate( player.body, { "x": speed, "y": 0 } );

		}

		// Check if falling, allow for a little bit of leeway.
		if( player.isGrounded && player.body.velocity.y > MAX_VELOCITY_Y_FOR_GROUNDED ) {
			player.isGrounded = false;
		}

		// Apply Jumping
		if( keys.ArrowUp ) {
			if( player.isGrounded ) {
				console.log( "falling - " + player.body.velocity.y );
			}
			if( player.isGrounded ) {
				Matter.Body.applyForce(
					player.body, player.body.position, { "x": 0, "y": JUMP_FORCE }
				);
				player.isGrounded = false;
			}
		}

		// Set the animation
		if( isWalking && player.isGrounded ) {
			setAnimation( "walk", player );
		} else if( !player.isGrounded ) {
			setAnimation( "jump", player );
		} else {
			setAnimation( "front", player );
		}
	}

	function setAnimation( name, actor ) {

		// If animation is already active then do nothing
		if( actor.animation === actor.animations[ name ] ) {
			return;
		}

		// Stop the current animation
		actor.animation.visible = false;
		actor.animation.gotoAndStop( 0 );

		// Math the orientation of the new animation to the current orientation
		actor.animations[ name ].scale.x = actor.animation.scale.x;

		// Start the new animation
		actor.animation = actor.animations[ name ];
		actor.animation.visible = true;
		actor.animation.play();
	}

	function moveCamera() {
		const player = game.player.obj;

		// Convert the coordinates to screen space.
		const left = -player.container.x / g.app.stage.scale.x;
		const top = -player.container.y / g.app.stage.scale.y;
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

	function setupInputs() {
		const keys = {};
		document.addEventListener( "keydown", keydown );
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
	}

	function keyup( e ) {
		game.keys[ e.key ] = false;
	}

	function collisionCheck( collisions ) {
		const pairs = collisions.source.pairs.list;
		for( let i = 0; i < pairs.length; i++ ) {
			const pair = pairs[ i ];
			const a = pair.bodyA.customData;
			const b = pair.bodyB.customData;

			console.log( a.type, b.type );
			const penetration = pair.collision.penetration;

			// Check for an actor hitting the ground
			if( a.type === "actor" && b.type === "ground" && penetration.y < 0 ) {
				game.itemsMap[ pair.bodyA.id ].isGrounded = true;
			} else if ( a.type === "ground" && b.type === "actor" && penetration.y > 0) {
				game.itemsMap[ pair.bodyB.id ].isGrounded = true;
			}

			// Check for a player hitting a pickup item.
			let actor;
			let pickup;
			if( a.type === "actor" && b.type === "pickup" ) {
				actor = game.itemsMap[ pair.bodyA.id ];
				pickup = game.itemsMap[ pair.bodyB.id ];
			} else if( a.type === "pickup" && b.type === "actor" ) {
				actor = game.itemsMap[ pair.bodyB.id ];
				pickup = game.itemsMap[ pair.bodyA.id ];
			}

			if( actor && pickup && actor.data.isPlayer ) {
				pickupItem( pickup );
			}

			// Check for a player hitting a trigger.
			if( a.type === "actor" && b.type === "trigger" ) {
				actor = game.itemsMap[ pair.bodyA.id ];
				triggers( actor, game.itemsMap[ pair.bodyB.id ] );
			} else if( a.type === "trigger" && b.type === "actor" ) {
				actor = game.itemsMap[ pair.bodyB.id ];
				triggers( actor, game.itemsMap[ pair.bodyA.id ] );
			}
		}
	}

	function pickupItem( pickup ) {
		// Remove the item from the physics world.
		Matter.Composite.remove( game.engine.world, pickup.body );

		// Remove the item from the game.
		game.items.splice( game.items.indexOf( pickup ), 1 );
		delete game.itemsMap[ pickup.body.id ];

		// Remove the item from the display.
		pickup.container.parent.removeChild( pickup.container );
		pickup.container.destroy();

		if( DEBUG ) {
			game.container.removeChild( pickup.debug );
		}

		// Update the player.
		if( pickup.data.isLetter ) {
			const letter = pickup.text;
			const index = game.word.indexOf( letter );
			game.player.letters = game.player.letters.substring( 0, index ) + letter +
				game.player.letters.substring( index + 1 );
			
			// Check if the word is complete
			if( game.player.letters === game.word ) {
				openExit();
			}
			updateHud();
		}
	}

	function openExit() {

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
		if( actor.data.isPlayer && trigger.name === "exit" && game.player.letters === game.word ) {
			closeLevel();
			g.showTitleScreen();
		}
	}

	function closeLevel() {
		clearInputs();
		g.app.ticker.remove( step );
		g.app.stage.removeChild( game.container );
		game.container.destroy();
		g.app.stage.removeChild( game.hud );
		game.hud.destroy();
		game.container = null;
		game.player = null;
		game.items = null;
		game.itemsMap = null;
		game.bodies = null;
		game.engine = null;
		game.runner = null;
		game.markers = null;
		game.level = null;
		game.tiles = null;
		game.word = null;
		game.hud = null;
	}

} )();

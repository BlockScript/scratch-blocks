/**
 * @license
 * Visual Blocks Editor
 *
 * Copyright 2018 Massachusetts Institute of Technology
 * All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Note input field, for selecting a musical note on a piano.
 * @author ericr@media.mit.edu (Eric Rosenbaum)
 */
'use strict';

goog.provide('Blockly.FieldNote');

goog.require('Blockly.DropDownDiv');
goog.require('Blockly.FieldTextInput');
goog.require('goog.math');
goog.require('goog.userAgent');

/**
 * Class for a note input field, for selecting a musical note on a piano.
 * @param {(string|number)=} opt_value The initial content of the field. The
 *     value should cast to a number, and if it does not, '0' will be used.
 * @param {Function=} opt_validator An optional function that is called
 *     to validate any constraints on what the user entered.  Takes the new
 *     text as an argument and returns the accepted text or null to abort
 *     the change.
 * @extends {Blockly.FieldTextInput}
 * @constructor
 */
Blockly.FieldNote = function(opt_value, opt_validator) {
  opt_value = (opt_value && !isNaN(opt_value)) ? String(opt_value) : '0';
  Blockly.FieldNote.superClass_.constructor.call(
      this, opt_value, opt_validator);
  this.addArgType('note');

  this.keySVGs = [];
  this.noteNameText = null;
  this.lowCText = null;
  this.highCText = null;

};
goog.inherits(Blockly.FieldNote, Blockly.FieldTextInput);

Blockly.FieldNote.playNote_ = null;

Blockly.FieldNote.TOP_MENU_HEIGHT = 28;
Blockly.FieldNote.SHADOW_HEIGHT = 4;
Blockly.FieldNote.SHADOW_COLOR = '#33333333';
Blockly.FieldNote.WHITE_KEY_COLOR = '#FFFFFF';
Blockly.FieldNote.BLACK_KEY_COLOR = '#323133';
Blockly.FieldNote.BLACK_KEY_STROKE = '#555555';
Blockly.FieldNote.KEY_SELECTED_COLOR = '#b0d6ff';
Blockly.FieldNote.WHITE_KEY_HEIGHT = 72;
Blockly.FieldNote.WHITE_KEY_WIDTH = 40;
Blockly.FieldNote.BLACK_KEY_HEIGHT = 40;
Blockly.FieldNote.BLACK_KEY_WIDTH = 32;
Blockly.FieldNote.BOTTOM_PADDING = 4;
Blockly.FieldNote.EDGE_KEY_WIDTH = 16;
Blockly.FieldNote.KEY_RADIUS = 6;
Blockly.FieldNote.OCTAVE_BUTTON_WIDTH = 32;

Blockly.FieldNote.KEY_INFO = [
  {name: 'B', pitch: -1},
  {name: 'C', pitch: 0},
  {name: 'C#', pitch: 1, isBlack: true},
  {name: 'D', pitch: 2},
  {name: 'Eb', pitch: 3, isBlack: true},
  {name: 'E', pitch: 4},
  {name: 'F', pitch: 5},
  {name: 'F#', pitch: 6, isBlack: true},
  {name: 'G', pitch: 7},
  {name: 'G#', pitch: 8, isBlack: true},
  {name: 'A', pitch: 9},
  {name: 'Bb', pitch: 10, isBlack: true},
  {name: 'B', pitch: 11},
  {name: 'C', pitch: 12},
  {name: 'C#', pitch: 13, isBlack: true},
  {name: 'D', pitch: 14}
];

/**
 * Construct a FieldNote from a JSON arg object.
 * @param {!Object} options A JSON object with options (angle).
 * @returns {!Blockly.FieldNote} The new field instance.
 * @package
 * @nocollapse
 */
Blockly.FieldNote.fromJson = function(options) {
  return new Blockly.FieldNote(options['note']);
};

/**
 * Path to the arrow svg icon.
 */
Blockly.FieldNote.ARROW_SVG_PATH = 'icons/arrow_button.svg';

/**
 * Clean up this FieldNote, as well as the inherited FieldTextInput.
 * @return {!Function} Closure to call on destruction of the WidgetDiv.
 * @private
 */
Blockly.FieldNote.prototype.dispose_ = function() {
  var thisField = this;
  return function() {
    Blockly.FieldNote.superClass_.dispose_.call(thisField)();
    if (thisField.mouseDownWrapper_) {
      Blockly.unbindEvent_(thisField.mouseDownWrapper_);
    }
  };
};

/**
 * Show a field with piano keys.
 * @private
 */
Blockly.FieldNote.prototype.showEditor_ = function() {
  var noFocus =
      goog.userAgent.MOBILE || goog.userAgent.ANDROID || goog.userAgent.IPAD;
  // Mobile browsers have issues with in-line textareas (focus & keyboards).
  Blockly.FieldNote.superClass_.showEditor_.call(this, noFocus);

  // If there is an existing drop-down someone else owns, hide it immediately and clear it.
  Blockly.DropDownDiv.hideWithoutAnimation();
  Blockly.DropDownDiv.clearContent();
  var div = Blockly.DropDownDiv.getContentDiv();

  // Build the SVG DOM.
  var fieldWidth = 8 * Blockly.FieldNote.WHITE_KEY_WIDTH +
    2 * Blockly.FieldNote.EDGE_KEY_WIDTH;
  var fieldHeight = Blockly.FieldNote.TOP_MENU_HEIGHT +
    Blockly.FieldNote.WHITE_KEY_HEIGHT +
    Blockly.FieldNote.BOTTOM_PADDING;

  var svg = Blockly.utils.createSvgElement('svg', {
    'xmlns': 'http://www.w3.org/2000/svg',
    'xmlns:html': 'http://www.w3.org/1999/xhtml',
    'xmlns:xlink': 'http://www.w3.org/1999/xlink',
    'version': '1.1',
    'height': fieldHeight + 'px',
    'width': fieldWidth + 'px'
  }, div);

  // Add the white and black keys
  this.keySVGs = [];
  this.mouseDownWrappers_ = [];

  // Since we are adding the keys from left to right in order, they need
  // to be in two groups in order to layer correctly.
  var whiteKeyGroup = Blockly.utils.createSvgElement('g', {}, svg);
  var blackKeyGroup = Blockly.utils.createSvgElement('g', {}, svg);

  var xIncrement, width, height, fill, stroke, group;
  // Start drawing the keys off the left edge (relying on the field's clipping)
  var x = Blockly.FieldNote.EDGE_KEY_WIDTH - Blockly.FieldNote.WHITE_KEY_WIDTH;
  var y = Blockly.FieldNote.TOP_MENU_HEIGHT;
  for (var i = 0; i < Blockly.FieldNote.KEY_INFO.length; i++) {
    // Draw a black or white key
    if (Blockly.FieldNote.KEY_INFO[i].isBlack) {
      // Black keys are shifted back half a key
      x -= Blockly.FieldNote.BLACK_KEY_WIDTH / 2;
      xIncrement = Blockly.FieldNote.BLACK_KEY_WIDTH / 2;
      width = Blockly.FieldNote.BLACK_KEY_WIDTH;
      height = Blockly.FieldNote.BLACK_KEY_HEIGHT;
      fill = Blockly.FieldNote.BLACK_KEY_COLOR;
      stroke = Blockly.FieldNote.BLACK_KEY_STROKE;
      group = blackKeyGroup;
    } else {
      xIncrement = Blockly.FieldNote.WHITE_KEY_WIDTH;
      width = Blockly.FieldNote.WHITE_KEY_WIDTH;
      height = Blockly.FieldNote.WHITE_KEY_HEIGHT;
      fill = Blockly.FieldNote.WHITE_KEY_COLOR;
      stroke = this.sourceBlock_.getColourTertiary();
      group = whiteKeyGroup;
    }
    var attr = {
      'd': this.getPianoKeyPath(x, y, width, height),
      'fill': fill,
      'stroke': stroke
    };
    x += xIncrement;

    this.keySVGs[i] = Blockly.utils.createSvgElement('path', attr, group);
    this.keySVGs[i].setAttribute('data-pitch', Blockly.FieldNote.KEY_INFO[i].pitch);
    this.keySVGs[i].setAttribute('data-name', Blockly.FieldNote.KEY_INFO[i].name);
    this.keySVGs[i].setAttribute('data-isBlack', Blockly.FieldNote.KEY_INFO[i].isBlack);

    this.mouseDownWrappers_[i] =
        Blockly.bindEvent_(this.keySVGs[i], 'mousedown', this, this.onMouseDown);
  }

  // Note name indicator at the top of the field
  this.noteNameText = Blockly.utils.createSvgElement('text',
      {
        'x': fieldWidth / 2,
        'y': Blockly.FieldNote.TOP_MENU_HEIGHT / 2,
        'class': 'blocklyText',
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
      }, svg);

  // Note names on the low and high C keys
  var lowCX = Blockly.FieldNote.EDGE_KEY_WIDTH + (Blockly.FieldNote.WHITE_KEY_WIDTH / 2);
  this.lowCText = this.addCKeyLabel(lowCX, svg);
  var highCX = lowCX + (Blockly.FieldNote.WHITE_KEY_WIDTH * 7);
  this.highCText = this.addCKeyLabel(highCX, svg);

  // Horizontal line at the top of the keys
  Blockly.utils.createSvgElement('line',
      {
        'stroke': this.sourceBlock_.getColourTertiary(),
        'x1': 0,
        'y1': Blockly.FieldNote.TOP_MENU_HEIGHT,
        'x2': fieldWidth,
        'y2': Blockly.FieldNote.TOP_MENU_HEIGHT
      }, svg);

  // Drop shadow at the top of the keys
  Blockly.utils.createSvgElement('rect',
      {
        'x': 0,
        'y': Blockly.FieldNote.TOP_MENU_HEIGHT,
        'width': fieldWidth,
        'height': Blockly.FieldNote.SHADOW_HEIGHT,
        'fill': Blockly.FieldNote.SHADOW_COLOR
      }, svg);

  // Octave buttons
  this.octaveDownButton = this.addOctaveButton(0, svg);
  this.octaveDownButton.setAttribute('transform', 'scale(-1, 1) ' +
    'translate(-' + Blockly.FieldNote.TOP_MENU_HEIGHT + ', 1)');
  this.octaveUpButton = this.addOctaveButton(fieldWidth - Blockly.FieldNote.TOP_MENU_HEIGHT, svg);

  this.octaveDownMouseDownWrapper =
    Blockly.bindEvent_(this.octaveDownButton, 'mousedown', this, this.octaveDown);
  this.octaveUpMouseDownWrapper =
      Blockly.bindEvent_(this.octaveUpButton, 'mousedown', this, this.octaveUp);

  Blockly.DropDownDiv.setColour(this.sourceBlock_.parentBlock_.getColour(),
      this.sourceBlock_.getColourTertiary());
  Blockly.DropDownDiv.setCategory(this.sourceBlock_.parentBlock_.getCategory());
  Blockly.DropDownDiv.showPositionedByBlock(this, this.sourceBlock_);

  this.updateSelection();
};

/**
 * Construct the SVG path string for a piano key shape: a rectangle with rounded
 * corners at the bottom.
 * @param {number} x the x position for the key.
 * @param {number} y the y position for the key.
 * @param {number} width the width of the key.
 * @param {number} height the height of the key.
 * @returns {string} the SVG path as a string.
 */
Blockly.FieldNote.prototype.getPianoKeyPath = function(x, y, width, height) {
  return  'M' + x + ' ' + y + ' ' +
    'L' + x + ' ' + (y + height -  Blockly.FieldNote.KEY_RADIUS) + ' ' +
    'Q' + x + ' ' + (y + height) + ' ' +
    (x + Blockly.FieldNote.KEY_RADIUS) + ' ' + (y + height) + ' ' +
    'L' + (x + width - Blockly.FieldNote.KEY_RADIUS) + ' ' + (y + height) + ' ' +
    'Q' + (x + width) + ' ' + (y + height) + ' ' +
    (x + width) + ' ' + (y + height - Blockly.FieldNote.KEY_RADIUS) + ' ' +
    'L' + (x + width) + ' ' + y + ' ' +
    'L' + x +  ' ' + y;
};

Blockly.FieldNote.prototype.addOctaveButton = function(x, svg) {
  var group = Blockly.utils.createSvgElement('g', {}, svg);
  var arrow = Blockly.utils.createSvgElement('image',
      {
        'width': Blockly.FieldNote.TOP_MENU_HEIGHT,
        'height': Blockly.FieldNote.TOP_MENU_HEIGHT,
        'x': x,
        'y': 0
      }, group);
  arrow.setAttributeNS(
      'http://www.w3.org/1999/xlink',
      'xlink:href',
      Blockly.mainWorkspace.options.pathToMedia + Blockly.FieldNote.ARROW_SVG_PATH
  );
  Blockly.utils.createSvgElement('line',
      {
        'stroke': this.sourceBlock_.getColourTertiary(),
        'x1': x - 2,
        'y1': 4,
        'x2': x - 2,
        'y2': Blockly.FieldNote.TOP_MENU_HEIGHT - 4
      }, group);
  return group;
};

Blockly.FieldNote.prototype.addCKeyLabel = function(x, svg) {
  return Blockly.utils.createSvgElement('text',
      {
        'x': x,
        'y': Blockly.FieldNote.TOP_MENU_HEIGHT + Blockly.FieldNote.WHITE_KEY_HEIGHT - 8,
        'class': 'scratchNotePickerKeyLabel',
        'text-anchor': 'middle',
      }, svg);
};

Blockly.FieldNote.prototype.onMouseDown = function(e) {
  var octaveNum = Math.floor(this.getText() / 12);
  var newNoteNum = Number(e.target.getAttribute('data-pitch')) + octaveNum * 12;
  this.setNoteNum(newNoteNum);
  this.playNoteInternal_();
};

Blockly.FieldNote.prototype.playNoteInternal_ = function() {
  if (Blockly.FieldNote.playNote_) {
    Blockly.FieldNote.playNote_(
        this.getValue(),
        this.sourceBlock_.parentBlock_.getCategory()
    );
  }
};

Blockly.FieldNote.prototype.noteNumToKeyIndex = function(noteNum) {
  return (Math.floor(noteNum) % 12) + 1;
};

Blockly.FieldNote.prototype.setNoteNum = function(noteNum) {
  this.setValue(noteNum);
  Blockly.FieldTextInput.htmlInput_.value = noteNum;
};

Blockly.FieldNote.prototype.updateSelection = function() {
  var noteNum = Number(this.getText());

  // Clear the highlight on all keys
  this.keySVGs.forEach(function(svg) {
    var isBlack = svg.getAttribute('data-isBlack');
    if (isBlack === 'true') {
      svg.setAttribute('fill', Blockly.FieldNote.BLACK_KEY_COLOR);
    } else {
      svg.setAttribute('fill', Blockly.FieldNote.WHITE_KEY_COLOR);
    }
  });
  var index = this.noteNumToKeyIndex(noteNum);
  // Set the highlight on the selected key
  if (this.keySVGs[index]) {
    this.keySVGs[index].setAttribute('fill', Blockly.FieldNote.KEY_SELECTED_COLOR);
    // Update the note name text
    var noteName =  Blockly.FieldNote.KEY_INFO[index].name;
    this.noteNameText.textContent = noteName + ' (' + Math.floor(noteNum) + ')';
    // Update the low and high C note names
    var lowCNum = Math.floor(this.getText() / 12) * 12;
    this.lowCText.textContent = 'C(' + lowCNum + ')';
    this.highCText.textContent = 'C(' + (lowCNum + 12) + ')';
  }
};

Blockly.FieldNote.prototype.octaveDown = function() {
  this.changeNoteBy(-12);
};

Blockly.FieldNote.prototype.octaveUp = function() {
  this.changeNoteBy(12);
};

Blockly.FieldNote.prototype.changeNoteBy = function(interval) {
  var newNote = Number(this.getText()) + interval;
  if (newNote < 0) return;
  this.setNoteNum(newNote);
  this.playNoteInternal_();
};

Blockly.FieldNote.prototype.setText = function(text) {
  Blockly.FieldNote.superClass_.setText.call(this, text);
  if (!this.textElement_) {
    // Not rendered yet.
    return;
  }
  this.updateSelection();
  // Cached width is obsolete.  Clear it.
  this.size_.width = 0;
};

Blockly.Field.register('field_note', Blockly.FieldNote);

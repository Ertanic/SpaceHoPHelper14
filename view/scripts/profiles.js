import { readTextFile } from '@tauri-apps/api/fs'
import { $settings } from './state';
import { Card, Category, Group, Row, RowItem, Section, Subcategory } from './elements';
import { removeOptions } from './utils';

export async function setProfile(profileName) {
    let profilePath;
    let profile;
    if (import.meta.env.VITE_WEB) {
        profilePath = 'profiles/' + $settings.profiles[profileName];
        profile = JSON.parse(await(await fetch(profilePath)).text());
    } else {
        profilePath = $settings.profiles[profileName];
        profile = JSON.parse(await readTextFile(profilePath))
    }

    // Mapping sections
    const sectionsById = new Map(profile.groups.flatMap(group => group.sections.map(section => [section.id, section])));

    // Selectors
    const positionSelects = [
        document.querySelector('#position-field > select')
        , document.querySelector('#position-new-field > select')
        , document.querySelector('#position-object-field > select')];
    const departmentSelect = document.querySelector('#department-field > select');
    const departmentCodeSelect = document.querySelector('#department-code-field > select');
    const statementTypeSelect = document.querySelector('#statement-type');
    const output = document.querySelector('#generated-statement');

    removeOptions([...positionSelects, departmentSelect, departmentCodeSelect, statementTypeSelect]);

    // Init list of statement types
    profile.groups.forEach(group => {
        const groupElement = Group(group.name);
        group.sections.forEach(section => {
            const sectionElement = Section(groupElement, section);
        })
        statementTypeSelect.appendChild(groupElement);
    })

    // Init list of positions
    positionSelects.forEach(select => {
        const undefinedOption = Section(null, { id: 1, name: profile.positions.undefined });
        select.appendChild(undefinedOption);

        let nextId = 2;
        Object.entries(profile.positions).forEach(([department, positions]) => {
            if (department === 'undefined') return;
            const departmentGroup = Group(department);
            positions.forEach(position => {
                const positionOption = Section(departmentGroup, { id: nextId, name: position });
                nextId += 1;
                departmentGroup.appendChild(positionOption);
            });
            select.appendChild(departmentGroup);
        });
    })

    // Init list of departments
    profile.departments.forEach((department, i) => {
        const departmentOption = Section(null, { id: i + 1, name: department });
        departmentSelect.appendChild(departmentOption);
    });

    // Init list of department codes
    profile.departmentsCodes.forEach((code, i) => {
        const codeOption = Section(null, { id: i + 1, name: code });
        departmentCodeSelect.appendChild(codeOption);
    });

    
    // TODO: Rewrite it in human language...
    let currentFields = [];
    const formFields = document.querySelectorAll('#application-form > .row > div > div');
    const hideFields = () => { formFields.forEach(field => field.classList.add('d-none')); currentFields = []; };
    const updateFields = (id) => {
        hideFields();
        const kebabize = (str) => str.replace(/[A-Z]+(?![a-z])|[A-Z]/g, ($, ofs) => (ofs ? "-" : "") + $.toLowerCase());

        const section = sectionsById.get(parseInt(id));
        section.fields.forEach(field => {
            const kebabizedField = kebabize(field);
            const fieldElement = document.querySelector(`#${kebabizedField}-field`);
            fieldElement.classList.remove('d-none');
            currentFields.push(kebabizedField);
        })
    }
    statementTypeSelect.addEventListener('change', e => updateFields(e.target.value));
    updateFields(statementTypeSelect.value);

    document.getElementById('application-form').addEventListener('submit', e => {
        e.preventDefault();
        while (output.firstChild) {
            output.removeChild(output.lastChild);
        }
    
        const camelize = s => s.replace(/-./g, x => x[1].toUpperCase())
        const selectFields = (d) => {
            const obj = {};
            currentFields.forEach(k => {
                const s = document.querySelector(`#${k}-field > select`);
                const val = s !== null ? s.options[d.get(k) - 1].textContent : d.get(k);
                obj[camelize(k)] = val;
            });
            obj['date'] = new Date(new Date().setFullYear(new Date().getFullYear() + 1000)).toLocaleDateString();
            obj['stationNumber'] = document.querySelector('#station-number').value;
            obj['time'] = document.querySelector('#timer-output').value || '00:00:00';
            return obj;
        };
    
        const data = new FormData(e.target);
        const dataObject = selectFields(data);
    
        const section = sectionsById.get(parseInt(statementTypeSelect.value));
    
        section.categories.forEach(category => {
            const categoryElement = Category(category.name);
    
            category.subcategories.forEach(sub => {
                const subcategoryElement = Subcategory(sub.name);
    
                sub.items.forEach(item => {
                    const { type, templates } = item;
                    const row = type === 'row' ? Row() : null;
    
                    templates.forEach(templateData => {
                        const { title, template } = templateData;
                        const cardTemplate = template.replace(/\$\{{2}([\w]+)\}{2}/g, (_, key) => dataObject[key]);
                        const card = Card(title, cardTemplate);
    
                        if (row) {
                            row.appendChild(RowItem(card));
                        } else {
                            subcategoryElement.appendChild(card);
                        }
                    });
    
                    if (row) {
                        subcategoryElement.appendChild(row);
                    }
                });
                categoryElement.appendChild(subcategoryElement);
            });
            output.appendChild(categoryElement);
        });
    });
}